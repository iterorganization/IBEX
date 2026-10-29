#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""Command-line interface for IBEX backend service."""

import argparse
import logging
import os
import sys
import time
import threading

import uvicorn

from ibex.main import app

LOG_LEVELS = ["debug", "info", "warning", "error"]


def parse_arguments():
    """
    Parse command-line arguments.

    Returns:
        tuple: (api_host, api_port, log_level)
            - api_host (str): Host address provided by the user. 127.0.0.1 otherwise.
            - api_port (int): The port provided by the user. 0 otherwise.
            - log_level (str): Log level provided by the user, else $IBEX_LOG_LEVEL, else warning.
    """
    parser = argparse.ArgumentParser(description="Start IBEX backend service")
    parser.add_argument(
        "-p",
        "--port",
        type=int,
        default=0,
        help="Specify port number to start server on {0..65535}",
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Specify host of backend server. Default: 127.0.0.1",
    )
    parser.add_argument(
        "--log-level",
        type=str.lower,
        choices=LOG_LEVELS,
        default=os.environ.get("IBEX_LOG_LEVEL", "warning").lower(),
        help="Console log level: info adds the access log, debug also the endpoint timings. "
        "Default: $IBEX_LOG_LEVEL, else warning",
    )
    args = parser.parse_args()
    # argparse doesn't check a default against choices, so check one coming from $IBEX_LOG_LEVEL
    if args.log_level not in LOG_LEVELS:
        parser.error(f"IBEX_LOG_LEVEL={args.log_level!r}: choose from {', '.join(LOG_LEVELS)}")

    api_port = args.port
    api_host = args.host

    if api_port < 0 or api_port > 65535:
        print(
            f"Provided port number was {args.port} while it has to be in range (0..65535).",
            file=sys.stderr,
        )
        sys.exit(-1)

    return api_host, api_port, args.log_level


def main():
    """Entry point for the run_ibex_service command."""
    host, port, log_level = parse_arguments()

    logging.getLogger("ibex").setLevel(log_level.upper())
    config = uvicorn.Config(app, host=host, port=port, log_level=log_level)
    server = uvicorn.Server(config)

    # Start the server in a background thread
    thread = threading.Thread(target=server.run)
    thread.start()

    # Wait until the server is started
    while not server.started:
        time.sleep(0.3)

    # Access the bound sockets
    sockets = server.servers[0].sockets
    port = sockets[0].getsockname()[1]
    print(f"Server is running on port {port}")


if __name__ == "__main__":
    main()
