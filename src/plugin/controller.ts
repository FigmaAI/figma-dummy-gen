// controller.ts

import Chance from 'chance';

figma.showUI(__html__, { width: 800, height: 600 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-component-set') {
    console.log('get-component-set');

    const nodes = figma.root.findAll((node) => node.type === 'COMPONENT_SET') as ComponentSetNode[];

    const componentSetData = nodes.map((node) => {

      const possibleDesigns = generatePropertyCombinations(node.componentPropertyDefinitions).length;
      const textNodeCount = calculateTextNodeCount(node.componentPropertyDefinitions);

      return {
        id: node.id,
        name: node.name,
        path: getNodePath(node),
        possibleDesigns,
        textNodeCount,
        documentationLinks: node.documentationLinks,
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
    // Excute the handleGenDummy function. If the function is async, await it. if it done, close the plugin. if it failed, show the error message.
    try {
      handleGenDummy(msg);
      // figma.closePlugin();
    } catch (error) {
      figma.notify('Dummy data generation failed!', { error: true, timeout: 5000 });
      console.error(error);
    }
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
function generatePropertyCombinations(componentPropertyDefinitions, textDummyCount?: number) {
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

    if (type === 'TEXT' && textDummyCount) {
      // console.log(componentPropertyDefinitions[property])
      const defaultValue = componentPropertyDefinitions[property].defaultValue;
      const defaultValueType = determineDefaultValueType(defaultValue);
      const numWords = defaultValue.split(' ').length;
      const averageWordLength = Math.round(defaultValue.length / numWords);
      const dummyTexts = generateDummyText(defaultValueType, textDummyCount, numWords, averageWordLength);

      for (const prevCombination of combinations) {
        for (const dummyText of dummyTexts) {
          newCombinations.push({ ...prevCombination, [property]: dummyText });
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
function handleGenDummy({ nodeId, textDummy }) {
  const node = figma.getNodeById(nodeId) as ComponentSetNode;

  // Get the current page
  const currentPage = figma.currentPage;

  // Get the last position from the plugin data
  let x = Number(currentPage.getPluginData('x')) || 0;
  let y = Number(currentPage.getPluginData('y')) || 0;

  // Get the width and height of the component set
  const { width, height } = node;

  // Generate all combinations of variant properties
  const variantCombinations = generatePropertyCombinations(node.componentPropertyDefinitions, textDummy);

  console.log(variantCombinations);

  // Create an instance for each combination of variant properties
  for (const combination of variantCombinations) {
    // Check if node.children array is not empty
    if (!node.children || node.children.length === 0) {
      console.error('Error: node.children array is empty');
      return;
    }

    // Get the ComponentNode that matches the combination of variant properties
    const component = node.children[0] as ComponentNode;
    const instance = component.createInstance() as InstanceNode;

    // If the number of combinations matches the number of child nodes, set properties without validation
    if (variantCombinations.length === node.children.length) {
      instance.setProperties(combination);
    } else {
      try {
        // Set the variant properties for the instance
        instance.setProperties(combination);
      } catch (error) {
        console.log(`Error setting properties for combination: ${node.id}`, error);
        instance.remove(); // Remove the instance

        continue; // Skip this combination and continue with the next one
      }
    }

    // Set the position of the new instance
    instance.x = x;
    instance.y = y;

    // Add the new instance to the current page
    currentPage.appendChild(instance);

    // Update the position for the next instance
    x += width + 10; // Add some padding
    if (x >= 20000) {
      // If the row is full, start a new row
      x = 0;
      y += height + 10; // Add some padding
    }
  }

  // Save the last position to the plugin data
  currentPage.setPluginData('x', String(x));
  currentPage.setPluginData('y', String(y));

  // Send completion message
  figma.ui.postMessage({
    type: 'gen-dummy-done',
    nodeId,
  });
}

// Function to determine the type of the defaultValue
function determineDefaultValueType(defaultValue: string): string {
  // Use regex to determine the type
  if (/^\d+$/.test(defaultValue)) return 'number';
  if (/^true|false$/.test(defaultValue)) return 'boolean';
  return 'string';
}

// Function to generate a dummy text based on the type
function generateDummyText(type: string, count: number, numWords: number, averageWordLength: number): string[] {
  const chance = new Chance();
  const dummyTexts = [];

  for (let i = 0; i < count; i++) {
    switch (type) {
      case 'number':
        dummyTexts.push(chance.string({ length: numWords * averageWordLength, pool: '0123456789' }));
        break;
      case 'boolean':
        dummyTexts.push(chance.bool().toString());
        break;
      default:
        let text = '';
        for (let j = 0; j < numWords; j++) {
          text += chance.syllable({ syllables: averageWordLength }) + ' ';
        }
        dummyTexts.push(text.trim());
    }
  }

  return dummyTexts;
}
