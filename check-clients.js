const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let jsFiles = [];
walkDir('src/app', function(filePath) {
  if (filePath.endsWith('.js')) {
    jsFiles.push(filePath);
  }
});

jsFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('\"use client\"') && content.includes('useRouter')) {
    // Inject router.refresh() where there's showFeedback or result.success, if missing.
    // We'll just print them and I can edit them if needed.
    console.log(file);
  }
});
