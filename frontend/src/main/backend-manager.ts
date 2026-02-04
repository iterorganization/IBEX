import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import axios from 'axios';

export class BackendManager {
  private backendProcess: ChildProcess | null = null;
  private backendPort: number = 8000;
  private backendHost: string = '127.0.0.1';
  private backendReady: boolean = false;

  constructor() {
    // No need to detect Python anymore - we use PyInstaller binary
  }

  private async isPortInUse(port: number, host: string = '127.0.0.1'): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => {
        resolve(true); // Port is in use
      });
      server.once('listening', () => {
        server.close();
        resolve(false); // Port is available
      });
      server.listen(port, host);
    });
  }

  private getBackendBinaryPath(): string {
    if (app.isPackaged) {
      // In production, backend binary is bundled in resources
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return path.join((process as any).resourcesPath, 'backend', 'dist', 'run_ibex_service');
    } else {
      // In development, backend binary is in dist folder
      return path.join(app.getAppPath(), '..', '..', 'dist', 'run_ibex_service');
    }
  }

  private async waitForBackend(maxRetries: number = 30): Promise<boolean> {
    const url = `http://${this.backendHost}:${this.backendPort}/info/version`;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(url, { timeout: 1000 });
        if (response.status === 200) {
          console.info('Backend is ready!');
          this.backendReady = true;
          return true;
        }
      } catch (error) {
        // Backend not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.error('Backend failed to start within timeout period');
    return false;
  }

  async startBackend(): Promise<{ success: boolean; port: number; url: string }> {
    // Check if service is already running on the port
    const portInUse = await this.isPortInUse(this.backendPort, this.backendHost);
    if (portInUse) {
      console.info(`Backend service already running on port ${this.backendPort}`);
      const ready = await this.waitForBackend();
      if (ready) {
        const url = `http://${this.backendHost}:${this.backendPort}`;
        return {
          success: true,
          port: this.backendPort,
          url,
        };
      }
    }

    // Get path to PyInstaller binary
    const binaryPath = this.getBackendBinaryPath();
    
    console.info(`Starting backend service: ${binaryPath}`);
    
    // Check if binary exists
    if (!fs.existsSync(binaryPath)) {
      console.error(`Backend binary not found at: ${binaryPath}`);
      return {
        success: false,
        port: 0,
        url: '',
      };
    }

    // Make binary executable
    try {
      fs.chmodSync(binaryPath, 0o755);
    } catch (error) {
      console.warn(`Could not chmod binary: ${error}`);
    }

    return new Promise((resolve) => {
      let errorOutput = '';
      
      // Start the backend service binary
      this.backendProcess = spawn(
        binaryPath,
        ['--host', this.backendHost, '--port', this.backendPort.toString()],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
        }
      );

      if (!this.backendProcess) {
        console.error('Failed to spawn backend process');
        resolve({
          success: false,
          port: 0,
          url: '',
        });
        return;
      }

      this.backendProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.info(`[Backend] ${output}`);
        
        // Check if server started successfully and extract port
        if (output.includes('running on') || output.includes('Server is running')) {
          const match = output.match(/port\s+(\d+)/) || output.match(/:(\d+)/);
          if (match) {
            this.backendPort = parseInt(match[1], 10);
          }
        }
      });

      this.backendProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.error(`[Backend Error] ${output}`);
        errorOutput += output;
      });

      this.backendProcess.on('error', (error: Error) => {
        console.error('Failed to start backend:', error);
        resolve({
          success: false,
          port: 0,
          url: '',
        });
      });

      this.backendProcess.on('close', (code: number | null) => {
        console.info(`Backend process exited with code ${code}`);
        this.backendReady = false;
      });

      // Wait for backend to be ready
      setTimeout(async () => {
        const ready = await this.waitForBackend();
        const url = `http://${this.backendHost}:${this.backendPort}`;
        
        if (ready) {
          resolve({
            success: true,
            port: this.backendPort,
            url,
          });
        } else {
          resolve({
            success: false,
            port: this.backendPort,
            url,
          });
        }
      }, 2000);
    });
  }

  async stopBackend(): Promise<void> {
    if (this.backendProcess) {
      console.info('Stopping backend process...');
      this.backendProcess.kill();
      this.backendProcess = null;
      this.backendReady = false;
    }
  }

  getBackendUrl(): string {
    return `http://${this.backendHost}:${this.backendPort}`;
  }

  isReady(): boolean {
    return this.backendReady;
  }
}
