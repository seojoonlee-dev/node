import { type Node, type Edge, Position } from '@xyflow/react';
import dagre from 'dagre';

const NODE_WIDTH = 100;
const NODE_HEIGHT = 20;

export function getLayoutedElements(files: string[]) {
  const nodesMap = new Map<string, Node>();
  const edges: Edge[] = [];
  const edgeSet = new Set<string>();

  files.forEach((fullPath) => {
    const noExtPath = fullPath.replace(/\.[^/.]+$/, '');
    const parts = noExtPath.split('/');

    if (parts.length > 1 && parts[parts.length - 1] === parts[parts.length - 2]) {
      parts.pop(); 
    }

    let currentPath = '';

    parts.forEach((part, index) => {
      const parentPath = currentPath;
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
          // top-level notes are roots: no incoming edge, so no target handle
          type: index === 0 ? 'input' : undefined,
          className: 'graph-node',
        });
      } else if (isFinalNode) {
        nodesMap.get(currentPath)!.data.filePath = fullPath;
      }

      if (index > 0) {
        const edgeId = `edge-${parentPath}-${currentPath}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            source: parentPath,
            target: currentPath,
            type: 'bezier',
            className: 'graph-edge',
          });
        }
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

  const layoutedNodes: Node[] = nodes.map((node) => {
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