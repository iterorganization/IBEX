import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import axios from 'axios';

export class BackendManager {
  private backendProcess: ChildProcess | null = null;
  private backendPort: number = 8000;
  private backendHost: string = '127.0.0.1';
  private backendReady: boolean = false;
  private static readonly BASE_PORT = 8000;
  private remoteBackendUrl: string | null = null;

  constructor() {
    // Check for a remote backend URL from environment variables
    this.remoteBackendUrl = process.env.IBEX_BACKEND_URL || null;
    if (this.remoteBackendUrl) {
      console.info(`Remote backend URL configured: ${this.remoteBackendUrl}`);
    } else {
      console.info(
        'No remote backend URL configured. Will start a local backend.',
      );
    }
  }

  private async findFreePort(startPort: number): Promise<number> {
    let port = startPort;
    while (true) {
      if (!(await this.isPortInUse(port, this.backendHost))) {
        // Check if we can bind to it briefly
        try {
          return await new Promise((resolve) => {
            const server = net.createServer();
            server.listen(port, this.backendHost, () => {
              server.once('close', () => resolve(port));
              server.close();
            });
            server.on('error', () => resolve(this.findFreePort(port + 1)));
          });
        } catch {
          // Port might be taken between check and use, try next
          port++;
        }
      } else {
        port++;
      }
      if (port > 65535) {
        throw new Error('No free ports available.');
      }
    }
  }

  private async isPortInUse(
    port: number,
    host: string = '127.0.0.1',
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();

      const timeout = 200;
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        // An ECONNREFUSED error means the port is not in use.
        // Any other error could be something else, but for this purpose, we can treat it as 'not in use'.
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  private getBackendCommand(): string {
    // run_ibex_service is always available in PATH
    return 'run_ibex_service';
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
      } catch {
        // Backend not ready yet, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.error('Backend failed to start within timeout period');
    return false;
  }

  async startBackend(): Promise<{
    success: boolean;
    port: number;
    url: string;
  }> {
    // REMOTE BACKEND
    if (this.remoteBackendUrl) {
      try {
        const url = new URL(this.remoteBackendUrl);
        this.backendHost = url.hostname;
        this.backendPort = parseInt(url.port, 10);

        console.info(
          `Attempting to connect to remote backend at ${this.getBackendUrl()}`,
        );
        const ready = await this.waitForBackend();
        if (ready) {
          console.info('Successfully connected to remote backend.');
          return {
            success: true,
            port: this.backendPort,
            url: this.getBackendUrl(),
          };
        } else {
          console.error('Could not connect to the remote backend.');
          return {
            success: false,
            port: this.backendPort,
            url: this.getBackendUrl(),
          };
        }
      } catch (error) {
        console.error('Invalid remote backend URL provided.', error);
        return { success: false, port: 0, url: '' };
      }
    }

    // LOCAL BACKEND
    try {
      this.backendPort = await this.findFreePort(BackendManager.BASE_PORT);
      console.info(`Found free port for backend: ${this.backendPort}`);
    } catch (error) {
      console.error('Failed to find a free port for the backend.', error);
      return { success: false, port: 0, url: '' };
    }

    const backendCommand = this.getBackendCommand();
    const backendArgs = [
      '--host',
      this.backendHost,
      '--port',
      this.backendPort.toString(),
    ];

    console.info(
      `Starting backend service: ${backendCommand} ${backendArgs.join(' ')}`,
    );

    return new Promise((resolve) => {
      // Start the backend service
      this.backendProcess = spawn(backendCommand, backendArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

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
      });

      this.backendProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.error(`[Backend Error] ${output}`);
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
