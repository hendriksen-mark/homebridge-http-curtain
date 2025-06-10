from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from urllib.parse import urlparse, parse_qs

class SimpleHandler(BaseHTTPRequestHandler):
    current_pos = 50
    target_pos = 50
    state = "2"  # '2' means Idle

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/CurrentPos":
            response = self.current_pos
            print(f"Current Position: {response}")
        elif path == "/State":
            response = self.state
            print(f"Current State: {response}")
        elif path == "/setTargetPos":
            try:
                pos = int(query.get("Pos", [None])[0])
                self.target_pos = pos
                # Simulate state change
                if self.target_pos > self.current_pos:
                    self.state = "1"  # Opening
                elif self.target_pos < self.current_pos:
                    self.state = "0"  # Closing
                else:
                    self.state = "2"  # Idle
                self.current_pos = self.target_pos
                response = {"result": "ok", "targetPos": self.target_pos}
                print(f"Set Target Position: {self.target_pos}, State: {self.state}")
            except (TypeError, ValueError):
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error":"Invalid Pos"}')
                return
        elif path == "/getTargetPos":
            response = self.target_pos
            print(f"Target Position: {response}")
        elif path == "/identify":
            response = {"identified": True}
            print("Identify called")
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error":"Not found"}')
            return

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode('utf-8'))

if __name__ == "__main__":
    server_address = ('', 8000)  # Listen on all interfaces, port 8000
    httpd = HTTPServer(server_address, SimpleHandler)
    print("Serving on port 8000...")
    httpd.serve_forever()
