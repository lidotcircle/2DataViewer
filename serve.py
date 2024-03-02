#!/usr/bin/env python3


from bottle import get, run, static_file
import argparse


@get("/")
def getroot():
    return static_file("index.html", root="./")

@get("/<filepath:re:.*\\.html>")
def gethtml(filepath):
    return static_file(filepath, root="./")

@get("/<filepath:re:.*\\.js>")
def getjavascript(filepath):
    return static_file(filepath, root="./")

@get("/css/<filepath:re:.*\\.css>")
def getcss(filepath):
    return static_file(filepath, root="css")

@get("/fonts/<filepath:re:.*>")
def getfonts(filepath):
    return static_file(filepath, root="fonts")

global minCoord, maxCoord, frameOffset, openInput
minCoord = None
maxCoord = None
frameOffset = []
openInput = None

@get("/data-info")
def datainfo():
    if len(frameOffset) == 0 or minCoord is None or maxCoord is None:
        return {}
    else:
        return { "minxy": minCoord, "maxxy": maxCoord, "nframes": len(frameOffset) }

@get("/frame/<nx>")
def getFrame(nx):
    assert(openInput is not None)
    n = int(nx)
    openInput.seek(frameOffset[n])
    text = openInput.readline().strip()
    
    return { "drawings": [{ "m_type": "circle", "m_circleData": { "m_center": { "x": 0, "y": 0 }, "m_radius": int(n) * 10 + 99 }}] }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="serve 2DataViewer")
    parser.add_argument("--input", "-i", type=str, required=True, help="Input file containing drawings")
    parser.add_argument("--host",        type=str, default="0.0.0.0", help="listening host address")
    parser.add_argument("--port", "-p",  type=int, default=3527, help="listening port")
    args = parser.parse_args()

    openInput = open(args.input, "r")
    while True:
        off = openInput.tell()
        n = openInput.readline()
        if n == '':
            break
        else:
            frameOffset.append(off)

    run(host=args.host, port=args.port)
