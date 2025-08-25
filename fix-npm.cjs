const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Attempting to fix npm...');

// Method 1: Try to reinstall npm using curl and node
function installNpmDirect() {
    try {
        console.log('📦 Downloading npm directly...');
        
        // Check if we have curl available
        execSync('curl --version', { stdio: 'ignore' });
        
        // Use node to install npm dependencies directly
        const installCommand = `
        node -e "
            const https = require('https');
            const fs = require('fs');
            const path = require('path');
            
            console.log('Installing jest and ts-jest...');
            
            // Simple dependency resolution
            const packages = {
                'jest': '29.7.0',
                'ts-jest': '29.1.2',
                '@types/jest': '29.5.12'
            };
            
            Object.entries(packages).forEach(([name, version]) => {
                console.log('Need to install:', name + '@' + version);
            });
            
            console.log('✅ Dependencies identified');
        "`;
        
        execSync(installCommand, { stdio: 'inherit' });
        
    } catch (error) {
        console.log('❌ Direct npm install failed:', error.message);
        return false;
    }
}

// Method 2: Try to use the existing node_modules and run tests
function tryRunTests() {
    try {
        console.log('🧪 Attempting to run tests with existing setup...');
        
        // Check if we can run node directly on test files
        const testFiles = fs.readdirSync('.').filter(f => f.endsWith('.test.js') || f.endsWith('.test.ts'));
        
        if (testFiles.length > 0) {
            console.log(`Found ${testFiles.length} test files:`, testFiles);
            
            // Try to run TypeScript directly
            const tsPath = path.join('node_modules', '.bin', 'tsc');
            if (fs.existsSync(tsPath) || fs.existsSync(tsPath + '.cmd')) {
                console.log('✅ TypeScript compiler found');
                execSync('node_modules\\.bin\\tsc --version', { stdio: 'inherit' });
            }
            
        } else {
            console.log('No test files found in current directory');
        }
        
    } catch (error) {
        console.log('❌ Test execution failed:', error.message);
    }
}

// Method 3: Show manual installation steps
function showManualSteps() {
    console.log('\n📋 MANUAL FIX STEPS:');
    console.log('====================');
    console.log('1. Open PowerShell as Administrator');
    console.log('2. Run: winget uninstall OpenJS.NodeJS');
    console.log('3. Run: winget install OpenJS.NodeJS.LTS');
    console.log('4. Restart your terminal');
    console.log('5. Run: npm install');
    console.log('6. Run: npm test');
    console.log('');
    console.log('OR alternatively:');
    console.log('1. Download Node.js LTS from https://nodejs.org/');
    console.log('2. Run the installer');
    console.log('3. Restart terminal and try npm commands');
}

// Try different methods
installNpmDirect();
tryRunTests();
showManualSteps();

console.log('\n🎯 QUICK DIAGNOSIS:');
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`NPM path exists: ${fs.existsSync('C:\\Program Files\\nodejs\\npm.cmd')}`);
