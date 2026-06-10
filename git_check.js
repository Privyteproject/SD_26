const { execSync } = require('child_process');
const fs = require('fs');

try {
  const log = execSync('git log -p -n 1 docker-compose.yml', { encoding: 'utf8' });
  const content = execSync('git show origin/develop:docker-compose.yml', { encoding: 'utf8' });
  fs.writeFileSync('git_output.txt', log + '\n\n--- DEVELOP ---\n' + content);
} catch (e) {
  fs.writeFileSync('git_output.txt', e.toString());
}
