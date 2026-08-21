import urllib.request
import json

login_req = urllib.request.Request(
    'https://skybank-v12.vercel.app/api/auth/login',
    data=json.dumps({'identifier': 'ahsan@sky.com', 'password': 'Qur78Ahs@@'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
token = json.loads(urllib.request.urlopen(login_req).read().decode('utf-8'))['access_token']
print("Successfully authenticated as Admin, token received!")

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
with open('sky_banking_initial_data.json', 'rb') as f:
    file_bytes = f.read()

part_header = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="sky_banking_initial_data.json"\r\nContent-Type: application/json\r\n\r\n'.encode('utf-8')
part_footer = f'\r\n--{boundary}--\r\n'.encode('utf-8')
payload = part_header + file_bytes + part_footer

restore_req = urllib.request.Request(
    'https://skybank-v12.vercel.app/api/backup/import',
    data=payload,
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
)

res = urllib.request.urlopen(restore_req)
print(f"Restore response HTTP status: {res.status}")
print("Response body:", res.read().decode('utf-8'))
