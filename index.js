// Dimensions and layout
const width = 1000;
const height = 1000;
const innerRadius = Math.min(width, height) * 0.3;
const outerRadius = innerRadius * 1.2;

// Create SVG container
const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

// Tooltip
const tooltip = d3.select("body").append("div")
    .attr("id", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(0, 0, 0, 0.7)")
    .style("color", "white")
    .style("padding", "8px")
    .style("border-radius", "5px")
    .style("pointer-events", "none")
    .style("opacity", 0);

// Load JSON data
Promise.all([
    d3.json("nodes_updated.json"),
    d3.json("links_updated.json")
]).then(([nodes, links]) => {
    // Create an index for nodes
    const nodeIndex = new Map(nodes.map((d, i) => [d.id, i]));

    // Prepare matrix for chord layout
    const matrix = Array(nodes.length).fill(0).map(() => Array(nodes.length).fill(0));
    links.forEach(link => {
        const source = nodeIndex.get(link.source);
        const target = nodeIndex.get(link.target);
        if (source != null && target != null) {
            matrix[source][target] = link.weight;
        }
    });

    // Chord layout
    const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending)
        (matrix);

    // Define color scale
    const color = d3.scaleOrdinal()
        .domain(nodes.map(d => d.id))
        .range(d3.schemeCategory10);

    // Add groups (faculty and interests)
    const group = svg.append("g")
        .selectAll("g")
        .data(chord.groups)
        .enter().append("g");

    // Add arcs
    group.append("path")
        .attr("class", "arc")
        .style("fill", d => color(nodes[d.index].id))
        .style("stroke", d => color(nodes[d.index].id))
        .attr("d", d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
        );

    // Add text labels with interactivity
    group.append("text")
        .each(d => d.angle = (d.startAngle + d.endAngle) / 2)
        .attr("dy", ".35em")
        .attr("transform", d => `
            rotate(${(d.angle * 180 / Math.PI - 90)})
            translate(${outerRadius + 20})
            ${d.angle > Math.PI ? "rotate(180)" : ""}
        `)
        .style("text-anchor", d => d.angle > Math.PI ? "end" : "start")
        .style("font-size", "12px")
        .style("cursor", "pointer")
        .text(d => nodes[d.index].id)
        .on("mouseover", function (event, d) {
            const highlightColor = color(nodes[d.index].id);

            // Highlight related ribbons
            svg.selectAll(".chord")
                .transition().duration(200)
                .style("opacity", p => (p.source.index === d.index || p.target.index === d.index) ? 1 : 0.1)
                .style("fill", p => (p.source.index === d.index || p.target.index === d.index) ? highlightColor : "gray");

            // Highlight arc
            svg.selectAll(".arc")
                .transition().duration(200)
                .style("opacity", (p, i) => i === d.index ? 1 : 0.3)
                .style("fill", (p, i) => i === d.index ? highlightColor : color(nodes[p.index].id));

            // Highlight connected text
            group.selectAll("text")
                .transition().duration(200)
                .style("fill", (p, i) => {
                    // Highlight only connected nodes
                    return i === d.index || chord.some(c => 
                        (c.source.index === d.index && c.target.index === i) || 
                        (c.target.index === d.index && c.source.index === i)) ? highlightColor : "black";
                });

            // Show tooltip
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`
                <strong>${nodes[d.index].id}</strong><br>
                Type: ${nodes[d.index].type}<br>
                ${nodes[d.index].type === "faculty" ? `Total Interests: ${nodes[d.index].total_interests}` : ""}
            `)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", function () {
            // Reset ribbons
            svg.selectAll(".chord")
                .transition().duration(200)
                .style("opacity", 1)
                .style("fill", d => color(nodes[d.source.index].id));

            // Reset arcs
            svg.selectAll(".arc")
                .transition().duration(200)
                .style("opacity", 1)
                .style("fill", d => color(nodes[d.index].id));

            // Reset text color
            group.selectAll("text")
                .transition().duration(200)
                .style("fill", "black");

            // Hide tooltip
            tooltip.transition().duration(200).style("opacity", 0);
        });

    // Add ribbons (connections)
    svg.append("g")
        .selectAll("path")
        .data(chord)
        .enter().append("path")
        .attr("class", "chord")
        .attr("d", d3.ribbon()
            .radius(innerRadius)
        )
        .style("fill", d => color(nodes[d.source.index].id)) // Dynamically color ribbons
        .style("stroke", d => color(nodes[d.source.index].id)) // Match ribbon outline with node color
        .style("opacity", 1);
}).catch(err => console.error("Error loading data:", err));