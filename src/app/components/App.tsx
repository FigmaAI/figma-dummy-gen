import React from 'react';
import { Button, IconButton, Box } from '@mui/material';
import { DataGrid, GridRowSelectionModel, GridToolbarContainer } from '@mui/x-data-grid';
import { OpenInNew as OpenInNewIcon, Delete as DeleteIcon, AutoFixHigh as AutoFixHighIcon } from '@mui/icons-material';

function App() {
  const [rows, setRows] = React.useState([]);
  const [rowSelectionModel, setRowSelectionModel] = React.useState<GridRowSelectionModel>([]);

  const getComponentSet = () => {
    parent.postMessage({ pluginMessage: { type: 'get-component-set' } }, '*');
  };

  const generateDummyForSelectedRows = () => {
    rowSelectionModel.forEach((nodeId, index) => {
      setTimeout(() => {
        parent.postMessage({ pluginMessage: { type: 'gen-dummy', nodeId } }, '*');
      }, index * 500); // 500ms delay between each message
    });
  };

  const CustomToolbar = () => {
    if (rowSelectionModel.length === 0) {
      return null;
    }
  
    return (
      <GridToolbarContainer style={{ justifyContent: 'flex-end' }}>
        <Button
          variant="text"
          color="primary"
          startIcon={<AutoFixHighIcon />}
          onClick={generateDummyForSelectedRows}
        >
          Generate Dummy
        </Button>
      </GridToolbarContainer>
    );
  };

  const NoRowsComponent = () => (
    <Box display="flex" justifyContent="center" alignItems="center" height="100%">
      <Button variant="contained" color="primary" onClick={getComponentSet}>
        Get Component Set
      </Button>
    </Box>
  );

  const handleTextDummyChange = (e, id) => {
    const newRows = rows.map((row) => {
      if (row.id === id) {
        return { ...row, textDummy: e.target.value };
      }
      return row;
    });
    setRows(newRows);
  };

  const columns = [
    { field: 'path', headerName: 'Path', flex: 2 },
    { field: 'possibleDesigns', headerName: 'Variants', width: 100 },
    {
      field: 'textDummy',
      headerName: 'Dummy',
      width: 100,
      renderCell: (params) => {
        const hasTextNode = params.row.textNodeCount > 0;
        return (
          <div>
            <input
              type="number"
              min="1"
              max="100"
              value={params.row.textDummy || 1}
              disabled={!hasTextNode}
              onChange={(e) => handleTextDummyChange(e, params.row.id)}
            />
            {hasTextNode && ` X ${params.row.textNodeCount}`}
          </div>
        );
      },
    },
    {
      field: 'totalDesigns',
      headerName: 'Total',
      width: 100,
      valueGetter: (params) => (params.row.possibleDesigns || 1) * (params.row.textDummy || 1) * (params.row.textNodeCount || 1),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      width: 100,
      renderCell: (params) => {
        const hasDocumentationLinks = params.row.documentationLinks.length > 0;
        const handleDelete = () => {
          setRows(rows.filter((row) => row.id !== params.row.id));
        };

        return (
          <>
            <IconButton
              disabled={!hasDocumentationLinks}
              onClick={() => {
                if (hasDocumentationLinks) {
                  window.open(params.row.documentationLinks[0], '_blank');
                }
              }}
            >
              <OpenInNewIcon />
            </IconButton>
            <IconButton onClick={handleDelete}>
              <DeleteIcon />
            </IconButton>
          </>
        );
      },
    },
  ];

  React.useEffect(() => {
    window.onmessage = (event) => {
      const { type, data } = event.data.pluginMessage;
      if (type === 'component-set-data') {
        const updatedRows = data.map((item) => {
          const pathElements = item.path.split('/');
          const newPath = `${pathElements[1]}/${pathElements[pathElements.length - 1]}`;

          return {
            id: item.id,
            path: newPath,
            possibleDesigns: item.possibleDesigns,
            textNodeCount: item.textNodeCount,
            documentationLinks: item.documentationLinks,
          };
        });
        setRows(updatedRows);
      }
    };
  }, []);

  return (
    <div style={{ height: 560, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        slots={{
          noRowsOverlay: NoRowsComponent,
          toolbar: CustomToolbar,
        }}
        checkboxSelection
        onRowSelectionModelChange={(newRowSelectionModel) => {
          setRowSelectionModel(newRowSelectionModel);
        }}
        rowSelectionModel={rowSelectionModel}
      />
    </div>
  );
}

export default App;