const fs = require('fs'); 
const file = 'c:/Users/hp/OneDrive/Desktop/Nurotra/src/pages/ActionAgent/ActionAgentPage.jsx'; 
let text = fs.readFileSync(file, 'utf8'); 
text = text.replace(/const token = customToken \|\| localStorage\.getItem\('token'\) \|\| localStorage\.getItem\('nurotra_token'\);/g, "const token = customToken || JSON.parse(localStorage.getItem('nurotra_user')||'{}').token;"); 
text = text.replace(/const token = localStorage\.getItem\('token'\) \|\| localStorage\.getItem\('nurotra_token'\);/g, "const token = JSON.parse(localStorage.getItem('nurotra_user')||'{}').token;"); 
fs.writeFileSync(file, text);
