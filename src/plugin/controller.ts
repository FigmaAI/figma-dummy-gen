// controller.ts

import Chance from 'chance';

figma.showUI(__html__, { width: 800, height: 600 });

// Function to handle different types of messages
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'get-component-set':
      handleGetComponentSet();
      break;
    case 'gen-dummy':
      handleGenDummy(msg);
      break;
    case 'navigate':
      handleNavigate(msg);
      break;
  }
};

// Function to handle 'get-component-set' message
function handleGetComponentSet() {
  console.log('get-component-set');

  const nodes = figma.root.findAll((node) => node.type === 'COMPONENT_SET') as ComponentSetNode[];

  const componentSetData = nodes
    .filter(isVisibleAndNotPrivate)
    .map(getComponentSetData)
    .filter((item) => item !== null); // Filter out any null items

  figma.ui.postMessage({
    type: 'component-set-data',
    data: componentSetData,
  });
}

// Function to check if a node is visible and not private
function isVisibleAndNotPrivate(node) {
  return node.visible && !node.name.startsWith('_') && !node.name.startsWith('.');
}

// Function to get the data for a component set
function getComponentSetData(node) {
  try {
    const textNodeCount = calculateTextNodeCount(node.componentPropertyDefinitions);
    const nestedInstances = findExposedNestedInstances(node) || [];
    const nestedInstanceCount = nestedInstances ? nestedInstances.length : 0;
    const nestedInstanceCombinationsCount = calculateNestedInstanceCombinationsCount(nestedInstances);
    const possibleDesigns = generatePropertyCombinations(node.componentPropertyDefinitions).length;

    return {
      id: node.id,
      name: node.name,
      path: getNodePath(node),
      possibleDesigns,
      textNodeCount,
      nestedInstanceCount,
      nestedInstanceCombinationsCount,
      documentationLinks: node.documentationLinks,
      key: node.key,
      width: node.width,
      height: node.height,
    };
  } catch (error) {
    console.error(`Error getting component property definitions for "${node.name}": ${error.message}`);
    return null; // Return null if there was an error
  }
}

// Function to calculate the total number of combinations for nested instances
function calculateNestedInstanceCombinationsCount(nestedInstances) {
  return nestedInstances
    ? nestedInstances.reduce((total, instance) => {
        const mainComponent = instance.mainComponent;
        if (mainComponent.remote) {
          console.log(`Skipping remote instance "${instance.name}"`);
          return total;
        }
        const originComponentSet = mainComponent.parent as ComponentSetNode;
        return total + generatePropertyCombinations(originComponentSet.componentPropertyDefinitions).length;
      }, 0)
    : 0;
}

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
function generatePropertyCombinations(
  componentPropertyDefinitions,
  textDummyCount?: number,
  nestedInstances?: InstanceNode[]
) {
  let combinations = [{}];

  // Generate combinations for the component set's properties
  combinations = generateCombinationsForProperties(componentPropertyDefinitions, textDummyCount, combinations);

  if (nestedInstances) {
    // Generate combinations for each nested instance's properties
    nestedInstances.forEach((instance) => {
      combinations = generateCombinationsForProperties(instance.componentProperties, textDummyCount, combinations);
    });
  }

  return combinations;
}

// Function to generate all combinations of properties for a component set
function generateCombinationsForProperties(propertyDefinitions, textDummyCount: number, prevCombinations: any[]) {
  let combinations = [...prevCombinations];

  for (const property in propertyDefinitions) {
    const { type, variantOptions } = propertyDefinitions[property];
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
      const defaultValue = propertyDefinitions[property].defaultValue;
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

function getParentPage(node: BaseNode): PageNode {
  let parent = node.parent;
  if (node.parent) {
    while (parent && parent.type !== 'PAGE') {
      parent = parent.parent;
    }
    return parent as PageNode;
  }
  return figma.currentPage;
}

// Recursive function to find all exposed nested instances in a node
function findExposedNestedInstances(node: SceneNode): InstanceNode[] {
  let instances: InstanceNode[] = [];

  if (node.type === 'INSTANCE') {
    instances = [...instances, ...node.exposedInstances];
  }

  if ('children' in node) {
    for (const child of node.children) {
      instances = [...instances, ...findExposedNestedInstances(child)];
    }
  }

  return instances;
}

// Function to handle 'navigate' message
function handleNavigate(msg) {
  const node = figma.getNodeById(msg.nodeId) as ComponentSetNode;
  const page = getParentPage(node);
  figma.currentPage = page;
  figma.viewport.scrollAndZoomIntoView([node]);
}