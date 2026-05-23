import subprocess
try:
    stdout = subprocess.check_output('npx tsc --noEmit', shell=True, text=True, stderr=subprocess.STDOUT)
    with open('logs.txt', 'w', encoding='utf-8') as f:
        f.write('Success: ' + stdout)
except subprocess.CalledProcessError as e:
    with open('logs.txt', 'w', encoding='utf-8') as f:
        f.write('Error: ' + e.output)
