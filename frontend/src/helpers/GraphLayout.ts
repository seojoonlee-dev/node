import { type Node, type Edge, Position } from '@xyflow/react';
import dagre from 'dagre';

const NODE_WIDTH = 120;
const NODE_HEIGHT = 20;

export function getLayoutedElements(files: string[]) {
  const nodesMap = new Map<string, Node>();
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  nodesMap.set('__root__', {
    id: '__root__',
    data: { label: 'Notes' },
    position: { x: 0, y: 0 },
    type: 'input',
    style: { background: '#1e1e1e', color: '#FFF0E3', border: '1px solid #FFF0E3' }
  });

  files.forEach((fullPath) => {
    const noExtPath = fullPath.replace(/\.[^/.]+$/, '');
    const parts = noExtPath.split('/');

    if (parts.length > 1 && parts[parts.length - 1] === parts[parts.length - 2]) {
      parts.pop(); 
    }

    let currentPath = '';

    parts.forEach((part, index) => {
      const parentPath = currentPath || '__root__';
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      
      const isFinalNode = index === parts.length - 1;

      if (!nodesMap.has(currentPath)) {
        nodesMap.set(currentPath, {
          id: currentPath,
          data: { 
            label: `${part}`, 
            filePath: isFinalNode ? fullPath : undefined 
          },
          position: { x: 0, y: 0 },
          style: {
            background: '#1e1e1e',
            color: '#FFF0E3',
            border: '1px solid #FFF0E3',
            borderRadius: '6px',
            padding: '8px'
          }
        });
      } else if (isFinalNode) {
        nodesMap.get(currentPath)!.data.filePath = fullPath;
      }

      const edgeId = `edge-${parentPath}-${currentPath}`;
      if (!edgeSet.has(edgeId) && currentPath !== '__root__') {
        edgeSet.add(edgeId);
        edges.push({
          id: edgeId,
          source: parentPath,
          target: currentPath,
          type: 'smoothstep',
          style: { stroke: '#5f5f5f' }
        });
      }
    });
  });

  const nodes = Array.from(nodesMap.values());

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  dagreGraph.setGraph({ rankdir: 'LR', nodesep: 35, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}