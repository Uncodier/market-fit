import { InstanceNode } from './app/types/instance-nodes';

export function getImprentaNodeWidth(node: InstanceNode, allNodes: InstanceNode[]): number {
  let aspectRatio = node.settings?.parameters?.aspectRatio;
  if (!aspectRatio && node.parent_node_id) {
    const parent = allNodes.find(n => n.id === node.parent_node_id);
    if (parent) {
      aspectRatio = parent.settings?.parameters?.aspectRatio;
    }
  }
  
  if (aspectRatio === '9:16' || aspectRatio === '3:4' || aspectRatio === '2:3') {
    return 320;
  }
  if (aspectRatio === '1:1') {
    return 400;
  }
  return 480;
}
