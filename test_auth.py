#!/usr/bin/env python3
import urllib.request
import urllib.error
import json
import base64
import sys

BACKEND = "http://localhost:3001"

def main():
    # Login
    data = json.dumps({"name": "Debug User", "email": "debugauth4@test.com", "password": "Test1234!"}).encode()
    req = urllib.request.Request(f"{BACKEND}/api/auth/register", data=data, headers={"Content-Type": "application/json"})
    try:
        resp = json.loads(urllib.request.urlopen(req).read())
    except Exception as e:
        print(f"LOGIN FAILED: {e}")
        sys.exit(1)

    token = resp["access_token"]
    user = resp["user"]
    print(f"Login OK: userId={user['id']}, onboardingStatus={user['onboardingStatus']}")
    print(f"Token: {token[:80]}...")

    # Decode token payload
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    decoded = json.loads(base64.b64decode(payload))
    print(f"\nToken payload: {json.dumps(decoded, indent=2)}")

    # Test protected endpoint
    req2 = urllib.request.Request(
        f"{BACKEND}/api/onboarding/tenant",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    )
    try:
        result = json.loads(urllib.request.urlopen(req2).read())
        print(f"\nGET /api/onboarding/tenant: {json.dumps(result, indent=2)}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"\nGET /api/onboarding/tenant: HTTP {e.code} - {body}")

if __name__ == "__main__":
    main()
