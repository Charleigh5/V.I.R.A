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

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    source: number;
    target: number;
}

const ConversationMapView: React.FC<ConversationMapViewProps> = ({ nodes, allActionItems, onCreateActionItem, onLinkActionItem }) => {
  const ref = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<ConversationNode | null>(null);


  useEffect(() => {
    const svgElement = d3.select(ref.current);
    if (!ref.current) return;

    if (nodes.length === 0) {
      svgElement.html(''); // Clear the SVG if no nodes
      return;
    }

    const width = ref.current.parentElement?.clientWidth || 800;
    const height = 600;

    const svg = svgElement
        .attr('width', width)
        .attr('height', height)
        .style('background-color', '#fff')
        .html(''); // Clear previous render

    const graphNodes: GraphNode[] = nodes.map(n => ({ id: n.node_id, data: n }));
    const graphLinks: GraphLink[] = nodes
        .filter(n => n.parent_node_id !== null)
        .map(n => ({ source: n.parent_node_id!, target: n.node_id }));

    const simulation = d3.forceSimulation(graphNodes)
        .force('link', d3.forceLink(graphLinks).id((d: any) => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));
    
    const link = svg.append('g')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .selectAll('line')
        .data(graphLinks)
        .join('line')
        .attr('stroke-width', 1.5);
    
    const node = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(graphNodes)
        .join('circle')
        .attr('r', 15)
        .attr('fill', '#4A90E2')
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
            if (event.defaultPrevented) return; // Ignore click if drag event occurred
            setSelectedNode(d.data);
        })
        .call(drag(simulation) as any);

    node.append('title')
        .text((d: any) => `${d.data.speaker_name}: ${d.data.summary}`);

    const labels = svg.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(graphNodes)
        .enter().append("text")
        .attr("dy", -20)
        .attr("text-anchor", "middle")
        .text((d: any) => d.data.speaker_name)
        .style("font-size", "10px")
        .style("fill", "#333");

    simulation.on('tick', () => {
        link
            .attr('x1', (d: any) => d.source.x)
            .attr('y1', (d: any) => d.source.y)
            .attr('x2', (d: any) => d.target.x)
            .attr('y2', (d: any) => d.target.y);

        node
            .attr('cx', (d: any) => d.x)
            .attr('cy', (d: any) => d.y);
        
        labels
            .attr("x", (d: any) => d.x)
            .attr("y", (d: any) => d.y);
    });

    function drag(simulation: d3.Simulation<GraphNode, undefined>) {
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
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="text-center p-10">
        <p className="text-neutral-500">No conversations found matching your search.</p>
      </div>
    );
  }

  return (
    <>
        <div className="px-6 pb-6">
            <div className="rounded-lg shadow-md overflow-hidden">
                <svg ref={ref}></svg>
            </div>
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