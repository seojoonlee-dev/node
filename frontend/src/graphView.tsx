import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, useNodesState, SelectionMode, Panel, Handle, Position, type Node, type NodeProps, type Viewport, type ReactFlowInstance } from '@xyflow/react';
import { getLayoutedElements } from './helpers/GraphLayout';
import { TintedImage } from './helpers/TintedImage';
import { ContextMenu } from './helpers/ContextMenu';
import { loadSavedViewport, saveViewport, loadSavedPositions, savePositions, clearPositions, type NodePositions } from './helpers/graphStorage';
import { validateRename } from './helpers/paths';
import '@xyflow/react/dist/style.css';
import './style/Graph.css';

interface GraphViewProps {
  files: string[];
  onNodeClick: (path: string) => void;
  onNodeRename: (path: string, newTitle: string) => void;
  onNodeDelete: (path: string) => void;
}

interface FileNodeData {
  label: string;
  filePath?: string;
  isRoot?: boolean;
  renaming?: boolean;
  onRenameCommit?: (value: string) => void;
  onRenameCancel?: () => void;
}

const FileNode = ({ data }: NodeProps) => {
  const { label, isRoot, renaming, onRenameCommit, onRenameCancel } = data as unknown as FileNodeData;

  return (
    <>
      {!isRoot && <Handle type="target" position={Position.Left} />}
      {renaming ? (
        <input
          className="graph-node-rename nodrag"
          defaultValue={label}
          autoFocus
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameCommit?.(e.currentTarget.value);
            if (e.key === 'Escape') onRenameCancel?.();
          }}
          onBlur={(e) => onRenameCommit?.(e.currentTarget.value)}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        label
      )}
      <Handle type="source" position={Position.Right} />
    </>
  );
};

const nodeTypes = { fileNode: FileNode };

export const GraphView: React.FC<GraphViewProps> = ({ files, onNodeClick, onNodeRename, onNodeDelete }) => {
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

  const handleNodeDoubleClick = (_event: React.MouseEvent, node: Node) => {
    if (node.data?.filePath && typeof node.data.filePath === 'string') {
      onNodeClick(node.data.filePath);
    }
  };

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);

  const handleNodeContextMenu = (event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    if (node.data?.filePath && typeof node.data.filePath === 'string') {
      setContextMenu({ x: event.clientX, y: event.clientY, path: node.id });
    }
  };

  const [renaming, setRenaming] = useState<string | null>(null);

  const commitRename = useCallback((value: string) => {
    if (!renaming) return;
    const newTitle = validateRename(renaming, value);
    if (newTitle) {
      onNodeRename(renaming, newTitle);
    }
    setRenaming(null);
  }, [renaming, onNodeRename]);

  const displayNodes = useMemo(() => {
    if (!renaming) return nodes;
    return nodes.map((node) =>
      node.id === renaming
        ? { ...node, data: { ...node.data, renaming: true, onRenameCommit: commitRename, onRenameCancel: () => setRenaming(null) } }
        : node
    );
  }, [nodes, renaming, commitRename]);

  const savedViewport = useMemo(() => loadSavedViewport(), []);

  const handleMoveEnd = (_event: unknown, viewport: Viewport) => {
    saveViewport(viewport);
  };

  const handleNodeDragStop = () => {
    const positions: NodePositions = {};
    nodes.forEach((node) => {
      positions[node.id] = node.position;
    });
    savePositions(positions);
  };

  const instanceRef = useRef<ReactFlowInstance | null>(null);

  const handleResetPositions = () => {
    clearPositions();
    const { nodes: freshNodes } = getLayoutedElements(files);
    setNodes(freshNodes);

    requestAnimationFrame(() => instanceRef.current?.fitView());
  };

  return (
    <div className="graph-view">
      <ReactFlow
        onInit={(instance) => { instanceRef.current = instance; }}
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onNodeDragStop={handleNodeDragStop}
        onMoveEnd={handleMoveEnd}
        defaultViewport={savedViewport ?? undefined}
        fitView={!savedViewport}
        nodesConnectable={false}
        nodesDraggable={true}
        selectionOnDrag={false}
        selectionKeyCode="Shift"
        selectionMode={SelectionMode.Partial}
        panOnDrag
        zoomOnDoubleClick={false}
        proOptions={{hideAttribution: true}}
      >
        <Panel position="bottom-right">
          <button className= "btn-header" id="btn-reset" onClick={handleResetPositions}>
            <TintedImage src='/reset.png' alt='reset'></TintedImage>
          </button>
        </Panel>
      </ReactFlow>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onRename={setRenaming}
          onDelete={onNodeDelete}
        />
      )}
    </div>
  );
};