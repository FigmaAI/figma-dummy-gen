// controller.ts

figma.showUI(__html__, { width: 800, height: 600 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-component-set') {
    console.log('get-component-set');
    const nodes = figma.root.findAll((node) => node.type === 'COMPONENT_SET') as ComponentSetNode[];

    const componentSetData = nodes.map((node) => {
      const possibleDesigns = generatePropertyCombinations(node.componentPropertyDefinitions).length;
      const textNodeCount = calculateTextNodeCount(node.componentPropertyDefinitions);
      const documentationLinks = node.documentationLinks;

      return {
        id: node.id,
        name: node.name,
        path: getNodePath(node),
        possibleDesigns,
        textNodeCount,
        documentationLinks,
        key: node.key,
        width: node.width,
        height: node.height,
      };
    });

    figma.ui.postMessage({
      type: 'component-set-data',
      data: componentSetData,
    });
  }
  // Handle 'gen-dummy' message
  else if (msg.type === 'gen-dummy') {
    handleGenDummy(msg.nodeId);

    
  }
};

// Recursive function to get the path of a node
function getNodePath(node: SceneNode): string {
  // If the parent is a PageNode, return the node's name
  if (node.parent && node.parent.type === 'PAGE') {
    return node.parent.name + '/' + node.name;
  }
  // If the parent is a SceneNode (but not a PageNode), prepend the parent's name and recurse
  else if (node.parent && 'name' in node.parent) {
    return getNodePath(node.parent as SceneNode) + '/' + node.name;
  }
  // If the node has no parent, return the node's name
  else {
    return node.name;
  }
}

// Function to generate all combinations of properties for a component set
function generatePropertyCombinations(componentPropertyDefinitions) {
  let combinations = [{}];

  for (const property in componentPropertyDefinitions) {
    const { type, variantOptions } = componentPropertyDefinitions[property];
    const newCombinations = [];

    if (type === 'BOOLEAN') {
      for (const prevCombination of combinations) {
        newCombinations.push({ ...prevCombination, [property]: true });
        newCombinations.push({ ...prevCombination, [property]: false });
      }
    }

    if (type === 'VARIANT') {
      for (const prevCombination of combinations) {
        for (const option of variantOptions) {
          newCombinations.push({ ...prevCombination, [property]: option });
        }
      }
    }

    if (newCombinations.length > 0) {
      combinations = newCombinations;
    }
  }

  return combinations;
}

// Function to calculate the number of text nodes in a component set
function calculateTextNodeCount(componentPropertyDefinitions) {
  let count = 0;

  for (const property in componentPropertyDefinitions) {
    const { type } = componentPropertyDefinitions[property];

    if (type === 'TEXT') {
      count++;
    }
  }

  return count;
}

// Function to handle 'gen-dummy' message
function handleGenDummy(nodeId) {
  const node = figma.getNodeById(nodeId) as ComponentSetNode;

  // Get the current page
  const currentPage = figma.currentPage;

  // Get the last position from the plugin data
  let x = Number(currentPage.getPluginData('x')) || 0;
  let y = Number(currentPage.getPluginData('y')) || 0;

  // Get the width and height of the component set
  const { width, height } = node;

  // Generate all combinations of variant properties
  const variantCombinations = generatePropertyCombinations(node.componentPropertyDefinitions);

  // Create an instance for each combination of variant properties
  for (const combination of variantCombinations) {

    // Get the ComponentNode that matches the combination of variant properties
    const component = node.children[0] as ComponentNode;
    const instance = component.createInstance() as InstanceNode;

    // Set the variant properties for the instance
    instance.setProperties(combination);

    // Set the position of the new instance
    instance.x = x;
    instance.y = y;

    // Add the new instance to the current page
    currentPage.appendChild(instance);

    // Update the position for the next instance
    x += width + 10;  // Add some padding
    if (x >= 20000) {
      // If the row is full, start a new row
      x = 0;
      y += height + 10;  // Add some padding
    }
  }

  // Save the last position to the plugin data
  currentPage.setPluginData('x', String(x));
  currentPage.setPluginData('y', String(y));
}