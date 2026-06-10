import React, { useMemo } from 'react';
import { ReactFlow, type Node } from '@xyflow/react';
import { getLayoutedElements } from './helpers/GraphLayout';
import '@xyflow/react/dist/style.css';

interface GraphViewProps {
  files: string[];
  onNodeClick: (path: string) => void;
}

export const GraphView: React.FC<GraphViewProps> = ({ files, onNodeClick }) => {
  const { nodes, edges } = useMemo(() => getLayoutedElements(files), [files]);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    if (node.data?.filePath && typeof node.data.filePath === 'string') {
      onNodeClick(node.data.filePath);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', background: 'none' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        fitView
        nodesConnectable={false}
        nodesDraggable={true}
        proOptions={{hideAttribution: true}}
      >
      </ReactFlow>
    </div>
  );
};