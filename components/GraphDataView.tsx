import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Project, ActionItem, TaskStatus, ConversationNode } from '../types';
import Badge from './ui/Badge';

// --- TYPE DEFINITIONS ---
type NodeType = 'person' | 'action_item';

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: NodeType;
  data: any; // Person name (string) or ActionItem object
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: GraphNode;
  target: GraphNode;
}

// --- COMPONENT PROPS ---
interface GraphDataViewProps {
  project: Project;
  actionItems: ActionItem[];
  onUpdateActionItem: (item: ActionItem) => void;
}

// --- HELPER FUNCTIONS ---
const getStatusColor = (status: TaskStatus) => {
  const colors: Record<TaskStatus, string> = {
    [TaskStatus.Open]: '#9E9E9E',
    [TaskStatus.InProcess]: '#F5A623',
    [TaskStatus.TODO]: '#F5A623',
    [TaskStatus.IN_PROGRESS]: '#4A90E2',
    [TaskStatus.DONE]: '#7ED321',
    [TaskStatus.BLOCKED]: '#D0021B',
  };
  return colors[status] || '#9E9E9E'; // Default to gray
};

const getStatusBadgeColor = (status: TaskStatus) => {
    switch (status) {
        case TaskStatus.DONE: return 'green';
        case TaskStatus.IN_PROGRESS:
        case TaskStatus.InProcess:
        case TaskStatus.TODO:
             return 'yellow';
        case TaskStatus.BLOCKED: return 'red';
        default: return 'gray';
    }
}

// --- MAIN COMPONENT ---
const GraphDataView: React.FC<GraphDataViewProps> = ({ project, actionItems, onUpdateActionItem }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [linkableTaskId, setLinkableTaskId] = useState<string>('');

  // --- DATA PROCESSING ---
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    // FIX: Changed links to be of type GraphLink[] and used `as any` when pushing.
    // This informs TypeScript of the data shape after D3 mutates the links,
    // which resolves type errors in D3 selection callbacks.
    const links: GraphLink[] = [];
    const personNodeMap = new Map<string, GraphNode>();

    const addPersonNode = (name: string) => {
        if (!name || personNodeMap.has(name)) return;
        const newNode: GraphNode = { id: name, type: 'person', data: name };
        nodes.push(newNode);
        personNodeMap.set(name, newNode);
    };

    // 1. Add nodes from conversation speakers
    project.data?.conversation_nodes.forEach(node => addPersonNode(node.speaker_name));
    
    // 2. Add nodes and links from action items
    actionItems.forEach(item => {
        // Add action item node
        nodes.push({ id: item.id, type: 'action_item', data: item });

        // Add assignee node if not present, and create link
        if (item.assigned_to_name) {
            addPersonNode(item.assigned_to_name);
            links.push({ source: item.assigned_to_name, target: item.id } as any);
        }

        // Add link from conversation source if available
        if (item.sourceConversationNodeId) {
            const sourceNode = project.data?.conversation_nodes.find(n => n.node_id === item.sourceConversationNodeId);
            if (sourceNode?.speaker_name) {
                addPersonNode(sourceNode.speaker_name);
                links.push({ source: sourceNode.speaker_name, target: item.id } as any);
            }
        }
    });

    return { nodes, links };
  }, [project.data, actionItems]);

  const unassignedActionItems = useMemo(() => 
    actionItems.filter(item => !item.assigned_to_name || item.assigned_to_name.trim() === ''), 
  [actionItems]);

  const handleLinkTask = () => {
    if (!linkableTaskId || !selectedNode || selectedNode.type !== 'person') return;

    const taskToLink = actionItems.find(item => item.id === linkableTaskId);
    if (taskToLink) {
        onUpdateActionItem({
            ...taskToLink,
            assigned_to_name: selectedNode.data, // person's name is in `data`
        });
        setLinkableTaskId(''); // Reset dropdown
    }
  };

  // --- D3 RENDERING EFFECT ---
  useEffect(() => {
    const svgElement = d3.select(svgRef.current);
    const container = svgRef.current?.parentElement;
    if (!container || !graphData) return;

    const drag = (simulation: d3.Simulation<GraphNode, undefined>) => {
        const dragstarted = (event: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        const dragged = (event: any) => {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        const dragended = (event: any) => {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        return d3.drag<SVGCircleElement, GraphNode>().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    const render = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        svgElement.html('').attr('width', width).attr('height', height);

        const simulation = d3.forceSimulation(graphData.nodes)
            .force('link', d3.forceLink(graphData.links).id((d: any) => d.id).distance(120))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide().radius(30));

        const link = svgElement.append('g').selectAll('line')
            .data(graphData.links).join('line');

        const node = svgElement.append('g').selectAll('circle')
            .data(graphData.nodes).join('circle')
            .attr('r', d => d.type === 'person' ? 12 : 16)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
              setSelectedNode(prev => (prev?.id === d.id ? null : d));
              setLinkableTaskId(''); // Reset on node selection change
            })
            .on('mouseover', (event, d) => setHoveredNodeId(d.id))
            .on('mouseout', () => setHoveredNodeId(null))
            .call(drag(simulation));
            
        const labels = svgElement.append("g").selectAll("text")
            .data(graphData.nodes).enter().append("text")
            .attr('dy', -22)
            .attr('text-anchor', 'middle')
            .text(d => d.type === 'person' ? d.data : d.data.subject)
            .style('font-size', '10px').style('fill', '#333').style('pointer-events', 'none');

        // --- STYLE UPDATES ---
        const selectedConnections = new Set<string>();
        if (selectedNode) {
            selectedConnections.add(selectedNode.id);
            graphData.links.forEach(l => {
                if ((l.source as GraphNode).id === selectedNode.id) selectedConnections.add((l.target as GraphNode).id);
                if ((l.target as GraphNode).id === selectedNode.id) selectedConnections.add((l.source as GraphNode).id);
            });
        }

        const hoveredConnections = new Set<string>();
        if (hoveredNodeId) {
            hoveredConnections.add(hoveredNodeId);
            graphData.links.forEach(l => {
                const sourceId = (l.source as GraphNode).id;
                const targetId = (l.target as GraphNode).id;
                if (sourceId === hoveredNodeId) hoveredConnections.add(targetId);
                if (targetId === hoveredNodeId) hoveredConnections.add(sourceId);
            });
        }
        
        const isNodeVisible = (d: GraphNode) => {
            if (selectedNode) return selectedConnections.has(d.id);
            if (hoveredNodeId) return hoveredConnections.has(d.id);
            return true;
        };
        
        const isLinkVisible = (l: GraphLink) => {
            const sourceId = (l.source as GraphNode).id;
            const targetId = (l.target as GraphNode).id;
            if (selectedNode) return selectedConnections.has(sourceId) && selectedConnections.has(targetId);
            if (hoveredNodeId) return hoveredConnections.has(sourceId) && hoveredConnections.has(targetId);
            return true;
        };

        const transitionDuration = 200;
        const dimmedOpacity = selectedNode ? 0.2 : 0.3;

        node
            .attr('fill', d => d.type === 'person' ? '#4A90E2' : getStatusColor(d.data.status))
            .attr('stroke', d => d.id === selectedNode?.id ? '#212121' : '#fff')
            .attr('stroke-width', d => d.id === selectedNode?.id ? 3 : 1.5)
            .transition().duration(transitionDuration)
            .style('opacity', d => isNodeVisible(d) ? 1 : dimmedOpacity);

        link
            .attr('stroke', '#999')
            .transition().duration(transitionDuration)
            .style('stroke-opacity', l => isLinkVisible(l) ? 0.6 : 0.1);

        labels
            .transition().duration(transitionDuration)
            .style('opacity', d => isNodeVisible(d) ? 1 : dimmedOpacity);


        simulation.on('tick', () => {
            link.attr('x1', d => d.source.x!).attr('y1', d => d.source.y!)
                .attr('x2', d => d.target.x!).attr('y2', d => d.target.y!);
            node.attr('cx', d => d.x!).attr('cy', d => d.y!);
            labels.attr("x", d => d.x!).attr("y", d => d.y!);
        });
    };
    
    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();

  }, [graphData, selectedNode, hoveredNodeId]);

  return (
    <div className="w-full h-full relative bg-white rounded-lg shadow-md overflow-hidden">
        <svg ref={svgRef}></svg>
        {selectedNode && (
            <div className="absolute top-4 right-4 w-80 bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-neutral-200 animate-fade-in">
                <button onClick={() => { setSelectedNode(null); setLinkableTaskId(''); }} className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-700">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                </button>
                {selectedNode.type === 'person' ? (
                    <div>
                        <h3 className="text-lg font-bold text-neutral-800">{selectedNode.data}</h3>
                        <p className="text-sm text-neutral-500 mb-2">Project Contributor</p>
                        <hr className="my-2"/>
                        <h4 className="font-semibold text-sm mt-2 mb-1">Assigned Action Items:</h4>
                        <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                           {actionItems
                            .filter(item => item.assigned_to_name === selectedNode.data)
                            .map(item => (
                               <li key={item.id} className="p-1.5 bg-neutral-100 rounded-md">{item.subject}</li>
                           ))}
                        </ul>
                        {unassignedActionItems.length > 0 && (
                            <div className="mt-4 pt-3 border-t">
                                <h4 className="font-semibold text-sm mb-2">Link Unassigned Task</h4>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={linkableTaskId}
                                        onChange={(e) => setLinkableTaskId(e.target.value)}
                                        className="block w-full text-xs rounded-md border-neutral-300 shadow-sm focus:border-primary-blue focus:ring-primary-blue"
                                    >
                                        <option value="">Select a task...</option>
                                        {unassignedActionItems.map(item => (
                                            <option key={item.id} value={item.id} title={item.subject}>
                                                {item.subject.length > 30 ? `${item.subject.substring(0, 30)}...` : item.subject}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleLinkTask}
                                        disabled={!linkableTaskId}
                                        className="px-2 py-1 text-xs font-semibold rounded-md bg-primary-blue text-white hover:bg-blue-600 disabled:bg-neutral-300 disabled:cursor-not-allowed flex-shrink-0"
                                    >
                                        Link
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <Badge color={getStatusBadgeColor(selectedNode.data.status)}>{selectedNode.data.status}</Badge>
                        <h3 className="text-base font-bold text-neutral-800 mt-1">{selectedNode.data.subject}</h3>
                        <p className="text-xs text-neutral-600 mt-2 max-h-24 overflow-y-auto">{selectedNode.data.description}</p>
                        <div className="text-xs text-neutral-500 mt-3 space-y-1">
                            <p><strong>Assignee:</strong> {selectedNode.data.assigned_to_name}</p>
                            <p><strong>Due:</strong> {selectedNode.data.due_date}</p>
                            <p><strong>Priority:</strong> {selectedNode.data.priority}</p>
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default GraphDataView;