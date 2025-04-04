#!/usr/bin/env python3


from bottle import get, run, static_file
import argparse
import re
import sys


def tokenize(input_string):
    # Pattern to match tokens, improved to ignore comments
    token_pattern = r'\"[^\"]*\"|\(|\)|-?\d+\.\d+|-?\d+|\S+'
    # Split the input string into lines to handle comments
    lines = input_string.split('\n')
    tokens = []
    for line in lines:
        # Ignore content after a semicolon (comment)
        line = line.split(';', 1)[0]
        tokens.extend(re.findall(token_pattern, line))
    return tokens


def parse_tokens(tokens):
    tokenIdx = 0
    supported_shapes = [
        "circle", "line", "cline",
        "polygon", "compound", "arc"
    ]

    def next_token():
        nonlocal tokenIdx
        if tokenIdx >= len(tokens):
            return None
        idx = tokenIdx
        tokenIdx += 1
        return tokens[idx]

    def move_backward():
        nonlocal tokenIdx
        assert tokenIdx > 0
        tokenIdx -= 1

    def token_at(idx):
        idx += tokenIdx
        if idx >= len(tokens):
            return None
        return tokens[idx]

    def top_token():
        return token_at(0)

    def parse_shape():
        shape = {"type": next_token()}
        if shape["type"] == "compound":
            shape["shapes"] = []
            while top_token() and top_token() == '(':
                next_token()  # Consume opening '('
                if top_token() and top_token() not in supported_shapes:
                    move_backward()
                    break
                shape["shapes"].append(parse_shape())

        while top_token() and top_token() != ')':
            if top_token() == '(':
                next_token()  # Consume '('
                key = next_token()
                if shape["type"] in ["line", "cline"] and key == "point":
                    key = "point2" if "point1" in shape else "point1"
                if key in ['point', 'point1', 'point2', 'center']:
                    x = float(next_token())
                    y = float(next_token())
                    value = {'x': x, 'y': y}
                elif key in ['radius', 'width', 'startAngle', 'endAngle']:
                    value = float(next_token())
                elif key in ['isCounterClockwise']:
                    t = next_token().strip('"')
                    value = t == "true"
                elif key in ['color', 'comment', 'layer']:
                    value = next_token().strip('"')
                elif key in ['attr']:
                    name = next_token()
                    value = next_token().strip('"')
                    if name not in shape:
                        shape[name] = value
                    next_token()  # Consume ')'
                    continue
                next_token()  # Consume ')'
                if shape["type"] == "polygon" and key == "point":
                    shape.setdefault("points", []).append(value)
                else:
                    shape[key] = value
            else:
                break  # Unexpected token
        next_token()  # Consume closing ')'
        return shape

    def parse_scene():
        shapes = []
        next_token()  # Consume 'scene'
        while top_token() and top_token() != ')':
            if top_token() == '(':
                next_token()  # Consume opening '('
                if top_token() in supported_shapes:
                    shapes.append(parse_shape())
                else:
                    print(f"Unknown shape type: {top_token()}")
            else:
                next_token()  # Skip unexpected tokens
        next_token()  # Consume closing ')' for 'scene'
        return shapes

    # Start parsing from the 'scene' keyword
    if top_token() and top_token() == '(' and (token_at(1) == 'scene'
                                               or token_at(1) == 'base'):
        return parse_scene()
    else:
        print("Input does not start with a scene.")
        return []


@get("/")
def getroot():
    return static_file("index.html", root="./")


@get("/<filepath:re:.*\\.ico>")
def getfavicon(filepath):
    return static_file(filepath, root="./")


@get("/<filepath:re:.*\\.html>")
def gethtml(filepath):
    return static_file(filepath, root="./")


@get("/<filepath:re:.*\\.js>")
def getjavascript(filepath):
    return static_file(filepath, root="./")


@get("/<filepath:re:.*\\.wasm>")
def getwasm(filepath):
    return static_file(filepath, root="./")


@get("/<filepath:re:.*\\.map>")
def getmap(filepath):
    return static_file(filepath, root="./")


@get("/css/<filepath:re:.*\\.css>")
def getcss(filepath):
    return static_file(filepath, root="css")


@get("/fonts/<filepath:re:.*>")
def getfonts(filepath):
    return static_file(filepath, root="fonts")


global minCoord, maxCoord, frameOffsets, openInput
minCoord = {}
maxCoord = {}
frameOffsets = []
openInput = None


def mergePoint(p):
    global minCoord, maxCoord
    if len(minCoord) == 0:
        minCoord = p
        maxCoord = {"x": p["x"], "y": p["y"]}
    else:
        minCoord["x"] = min(minCoord["x"], p["x"])
        minCoord["y"] = min(minCoord["y"], p["y"])
        maxCoord["x"] = max(maxCoord["x"], p["x"])
        maxCoord["y"] = max(maxCoord["y"], p["y"])


@get("/data-info")
def datainfo():
    if len(frameOffsets) == 0 or len(minCoord) == 0 or len(maxCoord) == 0:
        return {}
    else:
        return {
            "minxy": minCoord,
            "maxxy": maxCoord,
            "nframes": len(frameOffsets)
        }


def getShapesFromFile(offsets, openFile):
    if len(offsets) == 0:
        return []
    assert (openFile is not None)
    text = ""
    for off in offsets:
        openFile.seek(off)
        text += openFile.readline().strip() + " "
    tokens = tokenize(text)
    return parse_tokens(tokens)


@get("/frame/<nx>")
def getFrame(nx):
    assert (openInput is not None)
    n = int(nx)
    if n >= len(frameOffsets):
        return {"drawings": []}
    ok1, ok2 = frameOffsets[n]
    shapes = getShapesFromFile(ok2, openInput) + \
        getShapesFromFile(ok1, openInput)
    return {"drawings": shapes}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="serve 2DataViewer")
    parser.add_argument("--input", "-i", type=str,
                        required=False, help="Input file containing drawings")
    parser.add_argument("--host",        type=str,
                        default="0.0.0.0", help="listening host address")
    parser.add_argument("--port", "-p",  type=int,
                        default=3527, help="listening port")
    args = parser.parse_args()

    baseOffsets = []
    sceneOffsets = []
    mode = "free"  # { free, base, scene }
    if args.input is not None:
        openInput = open(args.input, "r")
        while True:
            off = openInput.tell()
            line = openInput.readline()
            n = line.strip()
            if line == '':
                break
            if n == '' or n.startswith('#'):
                continue
            elif n.startswith("(base"):  # )
                if len(sceneOffsets) > 0:
                    frameOffsets.append([sceneOffsets, baseOffsets])
                baseOffsets = [off]
                mode = "base"
            elif n.startswith("(scene"):  # )
                if len(sceneOffsets) > 0:
                    frameOffsets.append([sceneOffsets, baseOffsets])
                sceneOffsets = [off]
                mode = "scene"
            elif mode == "base":
                baseOffsets.append(off)
            elif mode == "scene":
                sceneOffsets.append(off)
            else:
                print("unexpected tokens '{}'".format(n), file=sys.stderr)

        if len(sceneOffsets) > 0:
            frameOffsets.append([sceneOffsets, baseOffsets])
            sceneOffsets = []

        if (len(frameOffsets) > 1):
            ok1, ok2 = frameOffsets[0]
            try:
                shapes = getShapesFromFile(
                    ok1, openInput) + getShapesFromFile(ok2, openInput)
                for s in shapes:
                    if s["type"] == "circle":
                        c = s["center"]
                        r = s["radius"]
                        mergePoint({"x": c["x"] - r, "y": c["y"] - r})
                        mergePoint({"x": c["x"] - r, "y": c["y"] + r})
                        mergePoint({"x": c["x"] + r, "y": c["y"] + r})
                        mergePoint({"x": c["x"] + r, "y": c["y"] - r})
                    elif s["type"] == "line":
                        mergePoint(s["point1"])
                        mergePoint(s["point2"])
                    elif s["type"] == "cline":
                        mergePoint(s["point1"])
                        mergePoint(s["point2"])
                    elif s["type"] == "polygon":
                        for pt in s["points"]:
                            mergePoint(pt)
            except Exception as e:
                print(e)
                pass

        print("total frames = {}".format(len(frameOffsets)))

    if len(minCoord) == 0 or len(maxCoord) == 0:
        mergePoint({"x": 0, "y": 0})

    run(host=args.host, port=args.port)
