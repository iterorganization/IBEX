#!/bin/env python3
# -*- coding: utf-8 -*-

import argparse  # type: ignore

import sys
import time

import uvicorn                 # type: ignore
from fastapi import FastAPI    # type: ignore

from ibex.app import app

def port_from_cmdln():
    """
    Reads port number from commandline

    Returns:
    tuple:
    - api_host (str): Host address provided by the user. 127.0.0.1 otherwise.
    - api_port (int): The port provided by the user. 0 otherwise.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-p",
        "--port",
        type=int,
        default=0,
        help="""Specify port number to start server on {0..65535}""",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="""Specify host of backend server. Default: 127.0.0.1""",
    )
    args = parser.parse_args(args=sys.argv[1:])

    api_port = args.port
    api_host = args.host

    if api_port < 0 or api_port > 65535:
        print(
            f"Provided port number was {args.port} while it has to be in range (0..65535).",
            file=sys.stderr,
        )
        exit(-1)

    return api_host, api_port

def main():
    host, port = port_from_cmdln()

    config = uvicorn.Config(app, host=host, port=port)
    server = uvicorn.Server(config)

    # Start the server in a background thread or process
    import threading
    thread = threading.Thread(target=server.run)
    thread.start()

    # Wait until the server is started
    while not server.started:
        time.sleep(0.3)
        pass

    # Access the bound sockets
    sockets = server.servers[0].sockets
    port = sockets[0].getsockname()[1]
    print(f"Server is running on port {port}")

if __name__ == "__main__":
    main()