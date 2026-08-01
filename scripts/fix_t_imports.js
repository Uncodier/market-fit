const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');
const fs = require('fs');

const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
});

const reportPath = path.join(process.cwd(), 'hardcoded_strings_report.json');
const grouped = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
const filesToProcess = Object.keys(grouped);

for (const file of filesToProcess) {
    project.addSourceFileAtPath(path.join(process.cwd(), file));
}

let modifiedCount = 0;

for (const sourceFile of project.getSourceFiles()) {
    let modified = false;
    
    // Check if t is called somewhere
    const text = sourceFile.getFullText();
    if (!text.includes('t(')) continue;
    
    // Skip if t is already declared
    const hasTDecl = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some(d => {
        const nameNode = d.getNameNode();
        if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
            return nameNode.getElements().some(e => e.getName() === 't');
        }
        return nameNode.getText() === 't';
    });
    
    // Skip if t is a function parameter
    const hasTParam = sourceFile.getDescendantsOfKind(SyntaxKind.Parameter).some(p => p.getName() === 't');
    
    // Check if we need to add the import
    const hasImport = sourceFile.getImportDeclarations().some(i => 
        i.getModuleSpecifierValue().includes('LocalizationContext')
    );

    if (!hasTDecl && !hasTParam) {
        // Find default export or first exported component/function
        const functions = sourceFile.getFunctions();
        const arrowFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);
        
        let targetFunc = null;
        
        // Try to find default export
        const defaultExport = sourceFile.getDefaultExportSymbol();
        if (defaultExport) {
            const decl = defaultExport.getDeclarations()[0];
            if (decl) {
                if (decl.getKind() === SyntaxKind.FunctionDeclaration) {
                    targetFunc = decl;
                } else if (decl.getKind() === SyntaxKind.VariableDeclaration) {
                    const init = decl.getInitializer();
                    if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
                        targetFunc = init;
                    }
                }
            }
        }
        
        if (!targetFunc) {
            targetFunc = functions.find(f => f.isExported()) || functions[0];
        }
        
        if (!targetFunc && arrowFunctions.length > 0) {
            targetFunc = arrowFunctions[0];
        }

        if (targetFunc) {
            try {
                const body = targetFunc.getBody();
                if (body && body.getKind() === SyntaxKind.Block) {
                    body.insertStatements(0, 'const { t } = useLocalization();');
                    modified = true;
                }
            } catch (e) {}
        }
    }

    if (modified && !hasImport) {
        sourceFile.addImportDeclaration({
            namedImports: ['useLocalization'],
            moduleSpecifier: '@/app/context/LocalizationContext'
        });
        modified = true;
    }

    if (modified) {
        // Ensure "use client" if it's using Context (meaning it's a client component)
        // Check if there is 'use client'
        if (!text.includes('use client')) {
            sourceFile.insertStatements(0, '"use client";\n');
        }
        
        sourceFile.saveSync();
        modifiedCount++;
        console.log('Fixed', sourceFile.getFilePath());
    }
}

console.log(`Modified ${modifiedCount} files.`);
