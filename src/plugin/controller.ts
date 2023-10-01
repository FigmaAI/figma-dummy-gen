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

// Function to check if a node is visible and not private
function isVisibleAndNotPrivate(node) {
  return node.visible && !node.name.startsWith('_') && !node.name.startsWith('.');
}

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

function getComponentSetData(node) {
  try {
    const nestedInstanceCombinationsCount = calculateNestedInstanceCombinationsCount(node, 1);
    const possibleDesigns = generateCombinationsFromDefinitions(node.componentPropertyDefinitions, 1, [{}]);
    let textNodeCount = countTextNode(node.componentPropertyDefinitions);

    // Check if any child ComponentNode has a text variant
    for (const child of node.children) {
      if (child.type === 'COMPONENT') {
        // Create an instance of the component
        const instance = child.createInstance();

        // Check if the instance has any exposed instances with text variants
        for (const exposedInstance of instance.exposedInstances) {
          if (countTextNode(exposedInstance.componentProperties) > 0) {
            textNodeCount++;
            break;
          }
        }

        // Remove the instance from the document
        instance.remove();
      }
    }

    return {
      id: node.id,
      name: node.name,
      path: getNodePath(node),
      possibleDesigns: possibleDesigns.length,
      nestedInstanceDesignCount: nestedInstanceCombinationsCount,
      documentationLinks: node.documentationLinks,
      key: node.key,
      textDummy: 1,
      hasTextVariant: textNodeCount > 0 ? true : false,
      textNodeCount,
    };
  } catch (error) {
    console.error(`Error getting component property definitions for "${node.name}": ${error.message}`);
    return null;
  }
}

// Recursive function to get the first and last element of a node path
function getNodePath(node: SceneNode): string {
  // Initialize an empty array to hold the path elements
  let pathElements = [];

  // Recursive function to get the path elements
  function getPathElements(node: SceneNode) {
    // If the parent is a PageNode, add the node's name to the start of the array
    if (node.parent && node.parent.type === 'PAGE') {
      pathElements.unshift(node.name);
    }
    // If the parent is a SceneNode (but not a PageNode), add the node's name to the start of the array and recurse
    else if (node.parent && 'name' in node.parent) {
      pathElements.unshift(node.name);
      getPathElements(node.parent as SceneNode);
    }
    // If the node has no parent, add the node's name to the start of the array
    else {
      pathElements.unshift(node.name);
    }
  }

  // Call the recursive function to get the path elements
  getPathElements(node);

  // Return a string containing the first and last element of the path, separated by a slash
  return `${pathElements[0]}/${pathElements[pathElements.length - 1]}`;
}

// Function to handle 'gen-dummy' message
function handleGenDummy({ nodeId, textDummy }) {
  console.log('gen-dummy');
  const node = figma.getNodeById(nodeId) as ComponentSetNode;

  // Get defaults
  const currentPage = figma.currentPage;
  const component = node.children[0] as ComponentNode;
  const instance = component.createInstance() as InstanceNode;
  const { width, height } = node;
  // Set the name using getNodePath
  const path = getNodePath(node);

  // Get the last position from the plugin datas
  let x = Number(currentPage.getPluginData('x')) || 0;
  let y = Number(currentPage.getPluginData('y')) || 0;

  // Generate all combinations of variant properties
  const variantCombinations = generateCombinationsFromDefinitions(node.componentPropertyDefinitions, textDummy, [{}]);

  // Initialize a counter for the total index
  let totalIndex = 0;

  // Create an instance for each combination of variant properties
  variantCombinations.forEach((combination, index) => {
    try {
      instance.setProperties(combination);
      instance.name = path; // Add index to the name

      // nested instance related functions

      // get exposed instances
      const exposedInstances = instance.exposedInstances;

      // Function to clone instance and append to page
      const cloneAndAppendInstance = () => {
        // Create a clone of the instance
        const resultInstance: InstanceNode = instance.clone();

        // Set the name using the total index
        resultInstance.name += ` - ${++totalIndex}`;

        // Set the position of the new instance
        resultInstance.x = x;
        resultInstance.y = y;

        // Add the new instance to the current page
        currentPage.appendChild(resultInstance);

        // Update the position for the next instance
        x += width + 10;
        if (x >= 200000) {
          x = 0;
          y += height + 10;
        }

        // save the last position to the plugin datas
        currentPage.setPluginData('x', x.toString());
        currentPage.setPluginData('y', y.toString());
      };

      // Loop through each exposed instance and override its properties
      if (exposedInstances && exposedInstances.length > 0) {
        exposedInstances.forEach((exposedInstance) => {
          // gen combinations for exposed instance with id and properties
          const exposedInstanceCombinations = generateCombinationsFromProperties(
            exposedInstance.componentProperties,
            textDummy,
            [{}]
          );

          // If there are no exposed instance combinations, create a clone of the instance and add it to the page
          if (!exposedInstanceCombinations || exposedInstanceCombinations.length === 0) {
            cloneAndAppendInstance();
            return;
          }

          // Loop through each combination of exposed instance properties
          exposedInstanceCombinations.forEach((exposedInstanceCombination: { [key: string]: { value: any } }) => {
            // Remove type from the combination properties
            const exposedInstanceProperties = Object.fromEntries(
              Object.entries(exposedInstanceCombination).map(([key, { value }]) => [key, value])
            );

            try {
              // set combination properties into instance
              exposedInstance.setProperties(exposedInstanceProperties);
            } catch (error) {
              console.error(`Error setting properties for exposed instance: ${error.message}`);
              return;
            }

            cloneAndAppendInstance();
          });
        });
      } else {
        cloneAndAppendInstance();
      }
    } catch (error) {
      console.error(`[combination ${index + 1}] Error setting properties for instance: ${error.message}`);
      return;
    }
  });

  // Remove the instance from the document
  instance.remove();

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

// Function to handle 'navigate' message
function handleNavigate(msg) {
  const node = figma.getNodeById(msg.nodeId) as ComponentSetNode;
  const page = getParentPage(node);
  figma.currentPage = page;
  figma.viewport.scrollAndZoomIntoView([node]);
}

// Function to generate all combinations of properties for a component set
function generateCombinationsFromDefinitions(propertyDefinitions, textDummyCount: number, prevCombinations: any[]) {
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

// New function to generate all combinations of properties from componentProperties
function generateCombinationsFromProperties(componentProperties, textDummyCount: number, prevCombinations: any[]) {
  let combinations = [...prevCombinations];

  for (const property in componentProperties) {
    const { type, value } = componentProperties[property];
    const newCombinations = [];

    if (type === 'BOOLEAN') {
      for (const prevCombination of combinations) {
        // Add two new combinations for each previous combination: one with the property set to true, and one with the property set to false
        newCombinations.push({ ...prevCombination, [property]: { type, value: true } });
        newCombinations.push({ ...prevCombination, [property]: { type, value: false } });
      }
    }

    if (type === 'VARIANT') {
      for (const prevCombination of combinations) {
        newCombinations.push({ ...prevCombination, [property]: { type, value } });
      }
    }

    if (type === 'TEXT' && textDummyCount) {
      const actualValue = value;
      const defaultValueType = determineDefaultValueType(actualValue);
      const numWords = actualValue.split(' ').length;
      const averageWordLength = Math.round(actualValue.length / numWords);
      const dummyTexts = generateDummyText(defaultValueType, textDummyCount, numWords, averageWordLength);

      for (const prevCombination of combinations) {
        for (const dummyText of dummyTexts) {
          newCombinations.push({ ...prevCombination, [property]: { type, value: dummyText } });
        }
      }
    }

    if (newCombinations.length > 0) {
      combinations = newCombinations;
    }
  }

  return combinations;
}

function calculateNestedInstanceCombinationsCount(componentSetNode: ComponentSetNode, textDummy: number) {
  // Initialize an empty array to hold all nested instance combinations
  let allNestedInstanceCombinations: string[] = [];

  // Iterate over each child ComponentNode
  for (const child of componentSetNode.children) {
    if (child.type === 'COMPONENT') {
      // Create an instance of the component
      const instance = child.createInstance();

      // Add the combinations of the instance's exposedInstances to the array
      for (const exposedInstance of instance.exposedInstances) {
        // Skip if exposedInstance's componentProperties value is {}
        if (Object.keys(exposedInstance.componentProperties).length === 0) continue;

        // Generate combinations for the exposed instance's properties
        const combinations = generateCombinationsFromProperties(exposedInstance.componentProperties, textDummy, [{}]);

        // Add the combinations to the array
        allNestedInstanceCombinations = [...allNestedInstanceCombinations, ...combinations];
      }

      // Remove the instance from the document
      instance.remove();
    }
  }

  // Return the total number of combinations
  return allNestedInstanceCombinations.length;
}

// Function to count the number of text nodes in a component set
function countTextNode(componentPropertyDefinitions) {
  let textNodeCount = 0;

  for (const property in componentPropertyDefinitions) {
    const { type } = componentPropertyDefinitions[property];

    if (type === 'TEXT') {
      textNodeCount++;
    }
  }

  return textNodeCount;
}
