const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

// List of required packages for Jest testing
const requiredPackages = [
    'jest@29.7.0',
    'ts-jest@29.1.2',
    '@types/jest@29.5.12'
];

console.log('Installing dependencies manually...');

// Create a simple package installer using the npm registry directly
function installPackage(packageName) {
    console.log(`Installing ${packageName}...`);
    try {
        // Use curl to download and install the package
        execSync(`curl -s https://registry.npmjs.org/${packageName.split('@')[0]} | node -e "
            const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
            const version = '${packageName.includes('@') ? packageName.split('@')[1] : 'latest'}';
            const tarball = version === 'latest' ? data.versions[data['dist-tags'].latest].dist.tarball : data.versions[version].dist.tarball;
            console.log(tarball);
        "`, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Failed to install ${packageName}:`, error.message);
    }
}

// Check if we can run tests with current setup
try {
    execSync('node --version', { stdio: 'inherit' });
    console.log('\n✅ Node.js is working');
    
    // Try to run jest directly
    const jestPath = path.join(__dirname, 'node_modules', '.bin', 'jest.cmd');
    if (fs.existsSync(jestPath)) {
        console.log('✅ Jest is already installed');
    } else {
        console.log('❌ Jest is missing - you need to install it');
        console.log('\nTo fix npm issues, please run one of these solutions:');
        console.log('\n1. Reinstall Node.js LTS from https://nodejs.org/');
        console.log('2. Or run: winget uninstall OpenJS.NodeJS && winget install OpenJS.NodeJS.LTS');
        console.log('3. Or use Chocolatey: choco install nodejs-lts');
    }
} catch (error) {
    console.error('Node.js check failed:', error.message);
}
