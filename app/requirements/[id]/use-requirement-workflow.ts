"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"

import { type WorkflowNode } from "./requirement-detail-types"
import type { RequirementState } from "./use-requirement-state"
export function useRequirementWorkflow(state: RequirementState) {
  const { requirement, setRequirement, error, nodes, setNodes, connections, setConnections, setWorkflowHistory, setUnsavedChanges, isHistoryActionRef, isInitialLoadRef } = state
  // Track workflow history
  useEffect(() => {
    // Skip initial load
    if (isInitialLoadRef.current) {
      if (nodes.length > 0) {
        setWorkflowHistory({
          past: [{ nodes: JSON.parse(JSON.stringify(nodes)), connections: JSON.parse(JSON.stringify(connections)) }],
          future: []
        });
        isInitialLoadRef.current = false;
      }
      return;
    }

    if (isHistoryActionRef.current) {
      isHistoryActionRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      setWorkflowHistory(prev => {
        const lastState = prev.past[prev.past.length - 1];
        
        // Deep compare to prevent pushing duplicate states
        if (lastState && 
            JSON.stringify(lastState.nodes) === JSON.stringify(nodes) && 
            JSON.stringify(lastState.connections) === JSON.stringify(connections)) {
          return prev;
        }

        return {
          past: [...prev.past, { 
            nodes: JSON.parse(JSON.stringify(nodes)), 
            connections: JSON.parse(JSON.stringify(connections)) 
          }],
          future: []
        };
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [nodes, connections]);

  const handleUndoWorkflow = () => {
    setWorkflowHistory(prev => {
      if (prev.past.length <= 1) return prev; // Keep at least one initial state
      
      const newPast = [...prev.past];
      const currentState = newPast.pop(); // Pop current state
      const previousState = newPast[newPast.length - 1]; // Get previous state
      
      if (!previousState || !currentState) return prev;
      
      isHistoryActionRef.current = true;
      setNodes(previousState.nodes);
      setConnections(previousState.connections);
      setUnsavedChanges(true);
      
      return {
        past: newPast,
        future: [currentState, ...prev.future]
      };
    });
  };

  const handleRedoWorkflow = () => {
    setWorkflowHistory(prev => {
      if (prev.future.length === 0) return prev;
      
      const newFuture = [...prev.future];
      const nextState = newFuture.shift();
      
      if (!nextState) return prev;
      
      isHistoryActionRef.current = true;
      setNodes(nextState.nodes);
      setConnections(nextState.connections);
      setUnsavedChanges(true);
      
      return {
        past: [...prev.past, nextState],
        future: newFuture
      };
    });
  };
  
  // Handle adding requirement secret
  const handleAddRequirementSecret = async (id: string, name: string) => {
    try {
      const supabase = createClient();
      
      // Update local state first for responsiveness
      const updatedMetadata = {
        ...(requirement?.metadata || {}),
        secret_id: id,
        secret_name: name
      };
      
      // Also update database
      if (requirement) {
        const { error } = await supabase
          .from('requirements')
          .update({ metadata: updatedMetadata })
          .eq('id', requirement.id);
          
        if (error) throw error;
      }
      
      setRequirement(prev => prev ? {
        ...prev,
        metadata: updatedMetadata
      } : null);
      
      toast.success(`Secret ${name} linked to requirement`);
      
      // Auto-add secret node to workflow if it doesn't exist
      // First, find if we already have a secret node
      const existingSecretNodeIndex = nodes.findIndex(n => n.type === 'secret');
      
      if (existingSecretNodeIndex >= 0) {
        // Update existing secret node
        setNodes(currentNodes => currentNodes.map((n, idx) => 
          idx === existingSecretNodeIndex 
            ? { ...n, data: { ...n.data, secret_id: id, secret_name: name } }
            : n
        ));
      } else {
        // Find trigger node to position relative to it
        const triggerNode = nodes.find(n => n.type === 'trigger');
        
        const secretNodeId = `node-secret-${Date.now()}`;
        const newSecretNode = {
          id: secretNodeId,
          type: 'secret',
          position: { 
            // Place it to the left of the trigger node, or default position
            x: triggerNode ? Math.max(0, triggerNode.position.x - 350) : 50, 
            y: triggerNode ? triggerNode.position.y : 50 
          },
          data: { 
            secret_id: id, 
            secret_name: name 
          }
        };
        
        setNodes([...nodes, newSecretNode]);
        
        // Connect secret to trigger if trigger exists
        if (triggerNode) {
          setConnections([...connections, {
            id: `conn-secret-${Date.now()}`,
            from: secretNodeId,
            to: triggerNode.id,
            sourceHandle: 'success'
          }]);
        }
      }
      
      setUnsavedChanges(true);
      
    } catch (error: any) {
      console.error("Error linking secret to requirement:", error);
      toast.error(error.message || "Failed to link secret");
    }
  };

  // Handlers for workflow builder
  const handleAddNode = (type: string) => {
    // Determine position based on the last node, or use default if it's the first node
    let newX = 50;
    let newY = 150;
    
    let sourceHandleToConnect = 'success';
    let nodeToConnectFrom: WorkflowNode | undefined;

    if (nodes.length > 0) {
      if (type === 'trigger') {
        // Find last available secret node
        nodeToConnectFrom = [...nodes].reverse().find(n => n.type === 'secret' && !connections.some(c => c.from === n.id && c.sourceHandle === 'success'));
        
        if (nodeToConnectFrom) {
          const maxX = Math.max(...nodes.map(n => n.position.x));
          newX = maxX + 350;
          newY = nodeToConnectFrom.position.y;
          sourceHandleToConnect = 'success';
        } else {
          // Place new triggers below existing nodes, aligned to the left
          const maxY = Math.max(...nodes.map(n => n.position.y));
          newX = 50;
          newY = maxY + 200;
        }
      } else {
        // Place action or condition to the last available positive node
        nodeToConnectFrom = [...nodes].reverse().find(n => {
           // check which handle this node provides
           const positiveHandle = n.type === 'condition' ? 'true' : 'success';
           // check if it's connected
           const isConnected = connections.some(c => c.from === n.id && c.sourceHandle === positiveHandle);
           return !isConnected;
        });
        
        if (nodeToConnectFrom) {
          const maxX = Math.max(...nodes.map(n => n.position.x));
          newX = maxX + 350;
          newY = nodeToConnectFrom.position.y;
          sourceHandleToConnect = nodeToConnectFrom.type === 'condition' ? 'true' : 'success';
        } else {
          // Fallback
          const lastNode = nodes[nodes.length - 1];
          newX = lastNode.position.x + 350;
          newY = lastNode.position.y;
        }
      }
    }

    const newNode = {
      id: `node-${Date.now()}`,
      type,
      position: { x: newX, y: newY },
      data: { 
        label: `New ${type} node`,
        ...(type === 'trigger' ? { triggerType: 'schedule', cron: 'Run once' } : {}),
        ...(type === 'action' ? { retries: 0 } : {}),
        ...(type === 'condition' ? { logicalOperator: 'AND' } : {})
      }
    };
    setNodes([...nodes, newNode]);
    
    // Auto-connect to identified node
    if (nodeToConnectFrom) {
      setConnections([...connections, { 
        id: `conn-${Date.now()}`, 
        from: nodeToConnectFrom.id, 
        to: newNode.id,
        sourceHandle: sourceHandleToConnect
      }]);
    } else if (nodes.length > 0 && type !== 'trigger') {
      // Fallback: connect to the last node
      const lastNode = nodes[nodes.length - 1];
      setConnections([...connections, { 
        id: `conn-${Date.now()}`, 
        from: lastNode.id, 
        to: newNode.id,
        sourceHandle: lastNode.type === 'condition' ? 'true' : 'success'
      }]);
    }
    
    setUnsavedChanges(true);
  };
  return { handleUndoWorkflow, handleRedoWorkflow, handleAddRequirementSecret, handleAddNode }
}
