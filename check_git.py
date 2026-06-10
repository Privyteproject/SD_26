import subprocess

def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    return result.stdout + result.stderr

with open("git_output.txt", "w") as f:
    f.write(run("git log -p -n 1 docker-compose.yml"))
    f.write("\n\n--- origin/develop docker-compose.yml ---\n")
    f.write(run("git show origin/develop:docker-compose.yml"))
