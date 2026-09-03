import fs from 'fs';
import path from 'path';

let html = fs.readFileSync('original.html', 'utf-8');

// Basic HTML to JSX conversion
html = html.replace(/class=/g, 'className=');
html = html.replace(/for=/g, 'htmlFor=');
html = html.replace(/<img(.*?)>/g, (match, p1) => {
    if (match.endsWith('/>')) return match;
    return `<img${p1} />`;
});
html = html.replace(/<br>/g, '<br />');
html = html.replace(/<hr(.*?)>/g, (match, p1) => {
    if (match.endsWith('/>')) return match;
    return `<hr${p1} />`;
});
html = html.replace(/<input(.*?)>/g, (match, p1) => {
    if (match.endsWith('/>')) return match;
    return `<input${p1} />`;
});
// Handle simple style="display:none;" etc.
html = html.replace(/style="([^"]*)"/g, (match, styleString) => {
    const styles = styleString.split(';').filter(s => s.trim()).reduce((acc, style) => {
        const [key, value] = style.split(':').map(s => s.trim());
        if (key && value) {
            const camelKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
            acc.push(`${camelKey}: "${value}"`);
        }
        return acc;
    }, []);
    return `style={{ ${styles.join(', ')} }}`;
});

// Remove comments that are not inside JSX (or just leave them as JS comments or convert to JSX comments if inside tags)
// For simplicity, we can replace <!-- ... --> with {/* ... */}
html = html.replace(/<!--(.*?)-->/gs, '{/* $1 */}');

// We have the converted HTML, now let's extract sections manually or just dump it all in App.jsx for a quick working start, then split.
// Wait, the user asked to change from html to react.jsx and I proposed components.
// Let's create the components folder
if (!fs.existsSync('src/components')) {
    fs.mkdirSync('src/components');
}

// Function to extract a section based on string boundaries
function extractSection(startTag, endTag) {
    const startIdx = html.indexOf(startTag);
    if (startIdx === -1) return '';
    const endIdx = html.indexOf(endTag, startIdx + startTag.length);
    if (endIdx === -1) return '';
    return html.substring(startIdx + startTag.length, endIdx).trim();
}

// But it's easier to use the specific sections.
// E.g. <nav id="navbar">
const extractElement = (tagName, idOrClass) => {
    const regex = new RegExp(`<${tagName}[^>]*?${idOrClass}[\\s\\S]*?<\\/${tagName}>`, 'i');
    const match = html.match(regex);
    return match ? match[0] : '';
}
const extractElementByComment = (commentStart, commentEnd) => {
    const startIdx = html.indexOf(`{/* ${commentStart} */}`);
    const endIdx = html.indexOf(`{/* ${commentEnd} */}`);
    if (startIdx !== -1 && endIdx !== -1) {
        return html.substring(startIdx + `{/* ${commentStart} */}`.length, endIdx).trim();
    }
    return '';
}

// I will just use regex to extract major sections.
const navbar = html.substring(html.indexOf('<nav'), html.indexOf('</nav>') + 6);
const heroStart = html.indexOf('{/*  ==================== HERO ====================  */}');
const heroEnd = html.indexOf('{/*  ==================== BIKES FLEET ====================  */}');
const hero = html.substring(heroStart, heroEnd).trim();
const fleetIdx = html.indexOf('{/*  ==================== BIKES FLEET ====================  */}');
const fleetStr = html.substring(fleetIdx, html.indexOf('</section>', fleetIdx) + 10);
const whyUsIdx = html.indexOf('{/*  ==================== WHY US ====================  */}');
const whyUsStr = html.substring(whyUsIdx, html.indexOf('</section>', whyUsIdx) + 10);
const locationIdx = html.indexOf('{/*  ==================== LOCATION ====================  */}');
const locationStr = html.substring(locationIdx, html.indexOf('</section>', locationIdx) + 10);
const contactIdx = html.indexOf('{/*  ==================== CONTACT ====================  */}');
const contactStr = html.substring(contactIdx, html.indexOf('</section>', contactIdx) + 10);
const footerIdx = html.indexOf('{/*  ==================== FOOTER ====================  */}');
const footerStr = html.substring(footerIdx, html.indexOf('</footer>', footerIdx) + 9);
const promoIdx = html.indexOf('{/*  ==================== PROMO BAR ====================  */}');
const promoStr = html.substring(promoIdx, html.indexOf('</div>', promoIdx + 100) + 6); // roughly

const writeComponent = (name, content) => {
    const jsx = `
export default function ${name}() {
  return (
    <>
      ${content}
    </>
  );
}
`;
    fs.writeFileSync(`src/components/${name}.jsx`, jsx);
}

writeComponent('Navbar', navbar);
writeComponent('Hero', hero);
writeComponent('BikesFleet', fleetStr);
writeComponent('WhyUs', whyUsStr);
writeComponent('Location', locationStr);
writeComponent('Contact', contactStr);
writeComponent('Footer', footerStr);
// writeComponent('PromoBar', promoStr); // It's just a div, might be hard to extract reliably via regex without parsing.

const appJsx = `
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import BikesFleet from './components/BikesFleet';
import WhyUs from './components/WhyUs';
import Location from './components/Location';
import Contact from './components/Contact';
import Footer from './components/Footer';

function App() {
  return (
    <div className="font-sans antialiased">
      <div className="bg-mesh"></div>
      <Navbar />
      <main className="relative z-10">
        <Hero />
        <BikesFleet />
        <WhyUs />
        <Location />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

export default App;
`;
fs.writeFileSync('src/App.jsx', appJsx);
console.log('Conversion script done.');
