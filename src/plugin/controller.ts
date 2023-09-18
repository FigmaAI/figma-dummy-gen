// controller.ts

figma.showUI(__html__, { width: 360, height: 480 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-component-set') {
    console.log('get-component-set');
    const nodes = figma.root.findAll((node) => node.type === 'COMPONENT_SET') as ComponentSetNode[];

    

    const componentSetData = nodes.map((node) => {
      return {
        id: node.id,
        name: node.name,
        componentPropertyDefinitions: node.componentPropertyDefinitions
      };
    });

    figma.ui.postMessage({
      type: 'component-set-data',
      data: componentSetData
    });
  }
};