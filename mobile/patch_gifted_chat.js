const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      const original = content;

      // Match import { ... } from 'react-native-gesture-handler'
      content = content.replace(/import\s+type\s+\{([^}]*)\}\s+from\s+'react-native-gesture-handler'/g, (match) => { return match; }); // ignore types for now

      content = content.replace(/import\s+\{([^}]*)\}\s+from\s+'react-native-gesture-handler'/g, (match, importsStr) => {
        const parts = importsStr.split(',').map(s => s.trim()).filter(Boolean);
        const replaceWithRN = ['Text', 'Pressable', 'FlatList', 'TextInput'];
        const rnImports = parts.filter(x => replaceWithRN.includes(x));
        const rnghImports = parts.filter(x => !replaceWithRN.includes(x));

        if (rnImports.length === 0) return match;

        let res = '';
        if (rnImports.length > 0) {
          res += `import { ${rnImports.join(', ')} } from 'react-native';\n`;
        }
        if (rnghImports.length > 0) {
          res += `import { ${rnghImports.join(', ')} } from 'react-native-gesture-handler'`;
        }
        return res.trim();
      });

      if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log('Patched: ' + filePath);
      }
    }
  }
}

walk('node_modules/react-native-gifted-chat/src');
console.log('Done');
