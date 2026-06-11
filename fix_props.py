import re

file_path = 'app/components/agents/imprenta-panel.tsx'
with open(file_path, 'r') as f:
    content = f.read()

# Let's add the missing props to ImprentaNodeCardInner
props_to_add = """  nodes: InstanceNode[]
  dummyNodes: InstanceNode[]
  contexts: any[]
  supabase: any
  generatingNodeIds: Set<string>
  currentSite: any
  textParams: any
  imageParams: any
  videoParams: any
  audioParams: any
  renderMediaWithZoom: any
"""

# Find the props interface
interface_start = content.find('registerNodeRef: (id: string, el: HTMLDivElement | null) => void')
content = content[:interface_start] + props_to_add + content[interface_start:]

# Let's add them to the function arguments
args_to_add = """  nodes,
  dummyNodes,
  contexts,
  supabase,
  generatingNodeIds,
  currentSite,
  textParams,
  imageParams,
  videoParams,
  audioParams,
  renderMediaWithZoom,
"""
args_start = content.find('registerNodeRef,\n  actions')
content = content[:args_start] + args_to_add + content[args_start:]

# Now at the callsite inside ImprentaPanel
callsite_add = """                        nodes={nodes}
                        dummyNodes={dummyNodes}
                        contexts={contexts}
                        supabase={supabase}
                        generatingNodeIds={generatingNodeIds}
                        currentSite={currentSite}
                        textParams={textParams}
                        imageParams={imageParams}
                        videoParams={videoParams}
                        audioParams={audioParams}
                        renderMediaWithZoom={renderMediaWithZoom}
"""
callsite_start = content.find('registerNodeRef={registerNodeRef}\n                        actions={actionsRef.current}')
content = content[:callsite_start] + callsite_add + content[callsite_start:]

# Add handleCreateActionFromContext to actions
content = content.replace('isImprentaWorkflowActionNode: (node: InstanceNode) => boolean\n  }', 'isImprentaWorkflowActionNode: (node: InstanceNode) => boolean\n    handleCreateActionFromContext: (ctx: any) => void\n  }')
content = content.replace('getParentNode: (node: InstanceNode) => node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : undefined\n    }', 'getParentNode: (node: InstanceNode) => node.parent_node_id ? nodes.find(n => n.id === node.parent_node_id) : undefined,\n      handleCreateActionFromContext\n    }')

# Fix the inline actions.setNodes(prev => prev.map(n => ...)) type error
content = content.replace('actions.setNodes(prev => prev.map(n =>', 'actions.setNodes((prev: InstanceNode[]) => prev.map((n: InstanceNode) =>')
content = content.replace('actions.setNodes((prev) =>\n                                            prev.map((n)', 'actions.setNodes((prev: InstanceNode[]) =>\n                                            prev.map((n: InstanceNode)')

# Other instances of prev =>
content = content.replace('actions.setNodes(prev =>', 'actions.setNodes((prev: InstanceNode[]) =>')
content = content.replace('prev.map(n =>', 'prev.map((n: InstanceNode) =>')

# Let's replace 'handleCreateActionFromContext(' with 'actions.handleCreateActionFromContext('
content = content.replace('handleCreateActionFromContext(', 'actions.handleCreateActionFromContext(')

with open(file_path, 'w') as f:
    f.write(content)

print("Fixed missing props")
