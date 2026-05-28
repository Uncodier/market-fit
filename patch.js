const fs = require('fs');
const file = 'app/components/agents/imprenta-panel.tsx';
let code = fs.readFileSync(file, 'utf8');

const target = `
      if (orphansWithCtx.length > 0) {
        for (let pass = 0; pass < 10; pass++) {
          let changed = false
          orphansWithCtx.forEach(node => {
            if (!pos[node.id]) return
            const anchored = computeContextAnchoredPosition(node.id, pos)
            if (!anchored) return
            const dx = anchored.x - pos[node.id].x
            const dy = anchored.y - pos[node.id].y
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
              shiftSubtree(node.id, dx, dy)
              changed = true
            }
          })
          if (!changed) break
        }
      }
`;

const replacement = `
      if (orphansWithCtx.length > 0) {
        for (let pass = 0; pass < 10; pass++) {
          let changed = false
          
          // Group orphans by their computed anchor position to avoid overlaps
          const anchoredPositions = new Map<string, typeof orphansWithCtx>();
          const nodeAnchors = new Map<string, {x: number, y: number, avgCenter: number}>();
          
          orphansWithCtx.forEach(node => {
            if (!pos[node.id]) return
            const anchored = computeContextAnchoredPosition(node.id, pos)
            if (!anchored) return
            
            // Re-calculate avgCenter because computeContextAnchoredPosition subtracts myH / 2
            const myH = h(node.id)
            const avgCenter = anchored.y + myH / 2
            nodeAnchors.set(node.id, { x: anchored.x, y: anchored.y, avgCenter })
            
            // Group by approximate position (to handle exact same contexts)
            const key = \`\${Math.round(anchored.x)},\${Math.round(avgCenter)}\`;
            if (!anchoredPositions.has(key)) anchoredPositions.set(key, []);
            anchoredPositions.get(key)!.push(node);
          });
          
          anchoredPositions.forEach((group) => {
            if (group.length === 1) {
              const node = group[0];
              const anchored = nodeAnchors.get(node.id)!;
              const dx = anchored.x - pos[node.id].x;
              const dy = anchored.y - pos[node.id].y;
              if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                shiftSubtree(node.id, dx, dy);
                changed = true;
              }
            } else {
              // Multiple nodes want to be at the same anchor. Stack them vertically
              // and center the entire stack around the avgCenter.
              const anchorInfo = nodeAnchors.get(group[0].id)!;
              const avgCenter = anchorInfo.avgCenter;
              
              // Calculate total height of the group
              let totalH = 0;
              group.forEach(n => { totalH += subtreeHeight(n.id); });
              totalH += (group.length - 1) * V_GAP;
              
              let currentY = avgCenter - totalH / 2;
              
              group.forEach(node => {
                const targetX = anchorInfo.x;
                const dx = targetX - pos[node.id].x;
                const dy = currentY - pos[node.id].y;
                if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                  shiftSubtree(node.id, dx, dy);
                  changed = true;
                }
                currentY += subtreeHeight(node.id) + V_GAP;
              });
            }
          });
          
          if (!changed) break
        }
      }
`;

if (code.includes('if (orphansWithCtx.length > 0) {')) {
  // Be careful to replace exactly the block
  const start = code.indexOf('if (orphansWithCtx.length > 0) {');
  const endStr = 'if (!changed) break\n        }\n      }';
  const end = code.indexOf(endStr, start) + endStr.length;
  if (start !== -1 && end !== -1) {
    code = code.substring(0, start) + replacement.trim() + code.substring(end);
    fs.writeFileSync(file, code);
    console.log("Patched successfully!");
  } else {
    console.log("Could not find end of block");
  }
} else {
  console.log("Could not find target block");
}
