import urllib.request
import urllib.error
import json

login_req = urllib.request.Request(
    'https://skyariana-bank.vercel.app/api/auth/login',
    data=json.dumps({'identifier': 'ahsan@sky.com', 'password': 'Qur78Ahs@@'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
token = json.loads(urllib.request.urlopen(login_req).read().decode('utf-8'))['access_token']
print("Authentication successful! Token acquired.")

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
with open('sky_banking_initial_data.json', 'rb') as f:
    file_bytes = f.read()

part_header = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="sky_banking_initial_data.json"\r\nContent-Type: application/json\r\n\r\n'.encode('utf-8')
part_footer = f'\r\n--{boundary}--\r\n'.encode('utf-8')
payload = part_header + file_bytes + part_footer

restore_req = urllib.request.Request(
    'https://skyariana-bank.vercel.app/api/backup/import',
    data=payload,
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
)

try:
    res = urllib.request.urlopen(restore_req)
    print(f"Live database restore HTTP status: {res.status}")
    print("Response body:", res.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"HTTP ERROR {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print("General exception:", e)
