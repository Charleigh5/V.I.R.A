import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ConversationNode, ActionItem } from '../types';
import ConversationNodeDetailModal from './ConversationNodeDetailModal';

interface ConversationMapViewProps {
  nodes: ConversationNode[];
  allActionItems: ActionItem[];
  onCreateActionItem: (initialData: Partial<ActionItem>) => void;
  onLinkActionItem: (actionItemId: string, nodeId: number) => void;
}

interface GraphNode extends d3.SimulationNodeDatum {
    id: number;
    data: ConversationNode;
}

// D3's force simulation replaces link IDs with node objects. The original typing
// prevented TypeScript from recognizing that `d.source` and `d.target` become
// objects with `x` and `y` coordinates during the simulation tick.
// This interface now correctly inherits the types from d3.SimulationLinkDatum.
// By explicitly typing source and target as GraphNode, we inform TypeScript
// about the structure of the link data inside the simulation 'tick' function.
interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    source: GraphNode;
    target: GraphNode;
}

const ConversationMapView: React.FC<ConversationMapViewProps> = ({ nodes, allActionItems, onCreateActionItem, onLinkActionItem }) => {
  const ref = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<ConversationNode | null>(null);

  useEffect(() => {
    const svgElement = d3.select(ref.current);
    const container = ref.current?.parentElement;

    if (!container || nodes.length === 0) {
      svgElement.html(''); // Clear the SVG if no nodes or container
      return;
    }
    
    const drag = (simulation: d3.Simulation<GraphNode, undefined>) => {
        function dragstarted(event: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event: any) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function dragended(event: any) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    const renderGraph = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;

        svgElement.html(''); // Clear previous render to start fresh

        const svg = svgElement
            .attr('width', width)
            .attr('height', height)
            .style('background-color', '#fff')
            .on('click', () => setSelectedNode(null)); // Deselect on background click

        const graphNodes: GraphNode[] = nodes.map(n => ({ id: n.node_id, data: n }));
        
        // Create a set of all valid node IDs for quick lookup to prevent D3 errors.
        const nodeIds = new Set(graphNodes.map(n => n.id));

        const graphLinks: GraphLink[] = nodes
            // Only create links where the parent_node_id is not null and exists in our set of nodes.
            // This prevents errors if the AI returns a parent_node_id of 0 or some other non-existent ID for the root node.
            .filter(n => n.parent_node_id !== null && nodeIds.has(n.parent_node_id))
            // Cast to `any` because we are initializing with numeric IDs,
            // but D3 will populate `source` and `target` with full GraphNode objects.
            .map(n => ({ source: n.parent_node_id!, target: n.node_id } as any));

        const simulation = d3.forceSimulation(graphNodes)
            .force('link', d3.forceLink(graphLinks).id((d: any) => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2));
        
        const link = svg.append('g')
            .selectAll('line')
            .data(graphLinks)
            .join('line');
        
        const node = svg.append('g')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .selectAll('circle')
            .data(graphNodes)
            .join('circle')
            .attr('r', 15)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                if (event.defaultPrevented) return; // Ignore click if drag event occurred
                setSelectedNode(prev => (prev && prev.node_id === d.data.node_id ? null : d.data));
            })
            .call(drag(simulation) as any);

        node.append('title')
            .text((d) => `${d.data.speaker_name}: ${d.data.summary}`);

        const labels = svg.append("g")
            .attr("class", "labels")
            .selectAll("text")
            .data(graphNodes)
            .enter().append("text")
            .attr("dy", -20)
            .attr("text-anchor", "middle")
            .text((d) => d.data.speaker_name)
            .style("font-size", "10px")
            .style("fill", "#333");

        const selectedNodeId = selectedNode ? selectedNode.node_id : null;
        const connectedNodeIds = new Set<number>();

        if (selectedNodeId !== null) {
            connectedNodeIds.add(selectedNodeId);
            const selectedGraphNode = nodes.find(n => n.node_id === selectedNodeId);
            if (selectedGraphNode && selectedGraphNode.parent_node_id) {
                connectedNodeIds.add(selectedGraphNode.parent_node_id);
            }
            nodes.forEach(n => {
                if (n.parent_node_id === selectedNodeId) {
                    connectedNodeIds.add(n.node_id);
                }
            });
        }
        
        node
            .transition().duration(300)
            .attr('fill', d => {
                if (selectedNodeId === null) return '#4A90E2'; // default blue
                if (d.id === selectedNodeId) return '#F5A623'; // accent-yellow
                if (connectedNodeIds.has(d.id)) return '#A4C8F0'; // light blue
                return '#E0E0E0'; // neutral-300 (dimmed)
            })
            .attr('r', d => (d.id === selectedNodeId ? 20 : 15));

        link
            .transition().duration(300)
            .attr('stroke', d => {
                const sourceId = (d.source as GraphNode).id;
                const targetId = (d.target as GraphNode).id;
                if (selectedNodeId === null) return '#999';
                if ((sourceId === selectedNodeId && connectedNodeIds.has(targetId)) || (targetId === selectedNodeId && connectedNodeIds.has(sourceId))) {
                    return '#F5A623';
                }
                return '#E0E0E0';
            })
            .attr('stroke-opacity', d => selectedNodeId === null ? 0.6 : 1)
            .attr('stroke-width', d => {
                const sourceId = (d.source as GraphNode).id;
                const targetId = (d.target as GraphNode).id;
                if (selectedNodeId === null) return 1.5;
                if ((sourceId === selectedNodeId && connectedNodeIds.has(targetId)) || (targetId === selectedNodeId && connectedNodeIds.has(sourceId))) {
                    return 3;
                }
                return 1;
            });

        labels
            .transition().duration(300)
            .style('opacity', d => {
                if (selectedNodeId === null) return 1;
                return connectedNodeIds.has(d.id) || d.id === selectedNodeId ? 1 : 0.3;
            });


        simulation.on('tick', () => {
            link
                // With `d.source` and `d.target` correctly typed as `GraphNode`,
                // we can access their `x` and `y` properties directly without casting.
                .attr('x1', (d) => d.source.x!)
                .attr('y1', (d) => d.source.y!)
                .attr('x2', (d) => d.target.x!)
                .attr('y2', (d) => d.target.y!);

            node
                .attr('cx', (d) => d.x!)
                .attr('cy', (d) => d.y!);
            
            labels
                .attr("x", (d) => d.x!)
                .attr("y", (d) => d.y!);
        });
    }
    
    renderGraph(); // Initial render

    const resizeObserver = new ResizeObserver(renderGraph);
    resizeObserver.observe(container);

    return () => {
        resizeObserver.disconnect();
    };
  }, [nodes, selectedNode]);

  if (nodes.length === 0) {
    return (
      <div className="text-center p-10 flex items-center justify-center h-full">
        <p className="text-neutral-500">No conversation data available to display map.</p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full h-full">
        <svg ref={ref}></svg>
      </div>
      {selectedNode && (
          <ConversationNodeDetailModal 
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              allActionItems={allActionItems}
              onCreateActionItem={onCreateActionItem}
              onLinkActionItem={onLinkActionItem}
          />
      )}
    </>
  );
};

export default ConversationMapView;