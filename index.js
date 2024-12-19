// Dimensions and layout
const width = 1000;
const height = 1000;
const innerRadius = Math.min(width, height) * 0.25;
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

const legendData = [
    { label: "Faculty", color: "#500F87" },
    { label: "Interests", color: "black" }
];

// Add legend
const legend = svg.append("g")
    .attr("transform", `translate(${outerRadius + 100}, ${-outerRadius})`) // Position to the right of the diagram
    .selectAll("g")
    .data(legendData)
    .enter()
    .append("g")
    .attr("class", "legend")
    .attr("transform", (d, i) => `translate(0, ${i * 30})`);

// Legend rectangles
legend.append("rect")
    .attr("width", 20)
    .attr("height", 20)
    .style("fill", d => d.color);

// Legend text
legend.append("text")
    .attr("x", 30)
    .attr("y", 15)
    .style("font-size", "14px")
    .style("fill", "#333")
    .text(d => d.label);


// Load JSON data
Promise.all([
    d3.json("nodes_updated.json"),
    d3.json("links_updated.json")
]).then(([nodes, links]) => {
    // Create an index for nodes
    const nodeIndex = new Map(nodes.map((d, i) => [d.id, i]));

    // Create a mapping of faculty to their interests
    const facultyInterestsMap = new Map();
    links.forEach(link => {
        const sourceNode = nodes[nodeIndex.get(link.source)];
        const targetNode = nodes[nodeIndex.get(link.target)];
        if (sourceNode.type === "faculty" && targetNode.type === "interest") {
            if (!facultyInterestsMap.has(sourceNode.id)) {
                facultyInterestsMap.set(sourceNode.id, new Set());
            }
            facultyInterestsMap.get(sourceNode.id).add(targetNode.id);
        }
    });

    // Create a reverse mapping of interests to faculties
    const interestFacultyMap = new Map();
    links.forEach(link => {
        const sourceNode = nodes[nodeIndex.get(link.source)];
        const targetNode = nodes[nodeIndex.get(link.target)];
        if (sourceNode.type === "faculty" && targetNode.type === "interest") {
            if (!interestFacultyMap.has(targetNode.id)) {
                interestFacultyMap.set(targetNode.id, new Set());
            }
            interestFacultyMap.get(targetNode.id).add(sourceNode.id);
        }
    });

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
        .sortSubgroups(d3.descending)(matrix);

    // Define color scale
    const color = d3.scaleOrdinal()
        .domain(nodes.map(d => d.type))
        .range(["#500F87", "black"]); // Colors for faculty and interests

    // Add background arcs for groups
    const groups = [
        { type: "faculty", start: 0, end: nodes.filter(d => d.type === "faculty").length },
        { type: "interest", start: nodes.filter(d => d.type === "faculty").length, end: nodes.length }
    ];

    svg.append("g")
        .selectAll("path")
        .data(groups)
        .enter().append("path")
        .attr("class", "background-arc")
        .attr("d", d => d3.arc()({
            startAngle: chord.groups[d.start].startAngle,
            endAngle: chord.groups[d.end - 1].endAngle,
            innerRadius: outerRadius + 10,
            outerRadius: outerRadius + 20 // Slightly outside the main arcs
        }))
        .style("fill", d => color(d.type))
        .style("opacity", 0.8); // Transparent background arcs

    // Add groups (faculty and interests)
    const group = svg.append("g")
        .selectAll("g")
        .data(chord.groups)
        .enter().append("g");

    // Add arcs
    group.append("path")
        .attr("class", "arc")
        .style("fill", d => color(nodes[d.index].type))
        .style("stroke", d => color(nodes[d.index].type))
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
            translate(${outerRadius + 30})
            ${d.angle > Math.PI ? "rotate(180)" : ""}
        `)
        .style("text-anchor", d => d.angle > Math.PI ? "end" : "start")
        .style("font-size", "12px")
        .style("cursor", "pointer") // Pointer cursor for both faculty and interests
        .text(d => nodes[d.index].id)
        .on("click", function (event, d) {
            const node = nodes[d.index];
            if (node.type === "faculty" && node.googleScholarUrl) {
                window.open(node.googleScholarUrl, "_blank");
            } else if (node.type === "interest") {
                const query = encodeURIComponent(node.id);
                window.open(`https://www.google.com/search?q=${query}`, "_blank");
            }
        })
        .on("mouseover", function (event, d) {
            const node = nodes[d.index];

            // Highlight related ribbons
            svg.selectAll(".chord")
                .transition().duration(200)
                .style("opacity", p => (p.source.index === d.index || p.target.index === d.index) ? 1 : 0.1);

            // Bring related ribbons to the front
            svg.selectAll(".chord")
                .filter(p => p.source.index === d.index || p.target.index === d.index)
                .each(function() {
                    this.parentNode.appendChild(this);
                });

            // Highlight arc
            svg.selectAll(".arc")
                .transition().duration(200)
                .style("opacity", (p, i) => i === d.index ? 1 : 0.3);

            // Enlarge and underline the hovered text
            d3.select(this)
                .transition().duration(200)
                .style("font-size", "16px")
                .style("text-decoration", "underline");

            // Tooltip logic for faculty and interests
            if (node.type === "faculty") {
                const interests = Array.from(facultyInterestsMap.get(node.id) || []);
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`
                    <strong>${node.id}</strong><br>
                    Type: ${node.type}<br>
                    Interests: ${interests.length > 0 ? interests.join(", ") : "None"}<br>
                    <p>Click to View Google Scholar Profile</p>
                `)
                    .style("left", `${Math.min(event.pageX + 10, window.innerWidth - 200)}px`)
                    .style("top", `${Math.min(event.pageY + 10, window.innerHeight - 100)}px`);
            } else if (node.type === "interest") {
                const relatedFaculty = Array.from(interestFacultyMap.get(node.id) || []);
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip.html(`
                    <strong>${node.id}</strong><br>
                    Type: ${node.type}<br>
                    Related Faculty: ${relatedFaculty.length > 0 ? relatedFaculty.join(", ") : "None"}<br>
                    <p>Click to Search "${node.id}" on Google</p>
                `)
                    .style("left", `${Math.min(event.pageX + 10, window.innerWidth - 200)}px`)
                    .style("top", `${Math.min(event.pageY + 10, window.innerHeight - 100)}px`);
            }
        })
        .on("mouseout", function () {
            svg.selectAll(".chord").transition().duration(200).style("opacity", 0.2);
            svg.selectAll(".arc").transition().duration(200).style("opacity", 0.5);
            tooltip.transition().duration(200).style("opacity", 0);
            
            // Reset text style
            d3.select(this).transition().duration(200).style("font-size", "12px").style("text-decoration", "none");
            
            svg.selectAll(".chord").sort((a, b) => a.source.index - b.source.index); // Reset order
        });

    // Add ribbons (connections)
    svg.append("g")
        .selectAll("path")
        .data(chord)
        .enter().append("path")
        .attr("class", (d, i) => `chord chord-${i}`)
        .attr("d", d3.ribbon().radius(innerRadius))
        .style("fill", d => color(nodes[d.source.index].type))
        .style("stroke", d => d3.rgb(color(nodes[d.source.index].type)).darker())
        .style("opacity", 0.2);
        
}).catch(err => console.error("Error loading data:", err));
