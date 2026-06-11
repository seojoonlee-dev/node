import React, { useEffect, useMemo, useRef } from 'react';
import { ReactFlow, useNodesState, SelectionMode, Panel, type Node, type Viewport, type ReactFlowInstance } from '@xyflow/react';
import { getLayoutedElements } from './helpers/GraphLayout';
import { TintedImage } from './helpers/TintedImage';
import '@xyflow/react/dist/style.css';
import './style/Graph.css';

interface GraphViewProps {
  files: string[];
  onNodeClick: (path: string) => void;
}

const POSITIONS_KEY = 'graphNodePositions';
const VIEWPORT_KEY = 'graphViewport';

function loadSavedViewport(): Viewport | null {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadSavedPositions(): Record<string, { x: number; y: number }> {
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function migrateSavedPositions(oldDirPath: string, newDirPath: string) {
  const saved = loadSavedPositions();
  const migrated: Record<string, { x: number; y: number }> = {};
  let changed = false;

  Object.entries(saved).forEach(([id, position]) => {
    if (id === oldDirPath) {
      migrated[newDirPath] = position;
      changed = true;
    } else if (id.startsWith(oldDirPath + '/')) {
      migrated[newDirPath + id.slice(oldDirPath.length)] = position;
      changed = true;
    } else {
      migrated[id] = position;
    }
  });

  if (changed) {
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(migrated));
  }
}

export const GraphView: React.FC<GraphViewProps> = ({ files, onNodeClick }) => {
  const { nodes: layoutedNodes, edges } = useMemo(() => {
    const { nodes, edges } = getLayoutedElements(files);
    const saved = loadSavedPositions();
    return {
      nodes: nodes.map((node) =>
        saved[node.id] ? { ...node, position: saved[node.id] } : node
      ),
      edges,
    };
  }, [files]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);  

  useEffect(() => {
    setNodes(layoutedNodes);
  }, [layoutedNodes, setNodes]);

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    if (node.data?.filePath && typeof node.data.filePath === 'string') {
      onNodeClick(node.data.filePath);
    }
  };

  const savedViewport = useMemo(() => loadSavedViewport(), []);

  const handleMoveEnd = (_event: unknown, viewport: Viewport) => {
    localStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport));
  };

  const handleNodeDragStop = () => {
    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((node) => {
      positions[node.id] = node.position;
    });
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  };

  const instanceRef = useRef<ReactFlowInstance | null>(null);

  const handleResetPositions = () => {
    localStorage.removeItem(POSITIONS_KEY);
    const { nodes: freshNodes } = getLayoutedElements(files);
    setNodes(freshNodes);

    requestAnimationFrame(() => instanceRef.current?.fitView());
  };

  return (
    <div className="graph-view">
      <ReactFlow
        onInit={(instance) => { instanceRef.current = instance; }}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={handleMoveEnd}
        defaultViewport={savedViewport ?? undefined}
        fitView={!savedViewport}
        nodesConnectable={false}
        nodesDraggable={true}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[2]}
        proOptions={{hideAttribution: true}}
      >
        <Panel position="bottom-right">
          <button className= "btn-header" id="btn-reset" onClick={handleResetPositions}>
            <TintedImage src='reset.png' alt='reset'></TintedImage>
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};