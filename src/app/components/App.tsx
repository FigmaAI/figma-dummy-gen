import React, { useEffect, useState } from 'react';
import { Button, IconButton, Box, TextField, Tooltip } from '@mui/material';
import { DataGrid, GridRowSelectionModel, GridToolbarContainer, GridColDef, GridCellParams } from '@mui/x-data-grid';
import { OpenInNew as OpenInNewIcon, Delete as DeleteIcon, AutoFixHigh as AutoFixHighIcon } from '@mui/icons-material';

interface Row {
  id: string;
  path: string;
  possibleDesigns: number;
  textNodeCount: number;
  documentationLinks: string[];
  textDummy?: number;
}

function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>([]);

  const handleDelete = (id: string) => {
    setRows(rows.filter((row) => row.id !== id));
  };

  const handleTextDummyChange = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const newRows = rows.map((row) => {
      if (row.id === id) {
        return { ...row, textDummy: Number(e.target.value) };
      }
      return row;
    });
    setRows(newRows);
  };

  const getComponentSet = () => {
    parent.postMessage({ pluginMessage: { type: 'get-component-set' } }, '*');
  };

  const generateDummyForSelectedRows = () => {
    const nodeId = rowSelectionModel[0];
    if (nodeId) {
      const textDummy = rows.find((row) => row.id === nodeId)?.textDummy || 1;
      parent.postMessage({ pluginMessage: { type: 'gen-dummy', nodeId, textDummy } }, '*');
    }
  };

  useEffect(() => {
    window.onmessage = (event) => {
      const { type, data, nodeId } = event.data.pluginMessage;

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
      } else if (type === 'gen-dummy-done' && nodeId) {
        handleDelete(nodeId);
        generateDummyForSelectedRows(); // Generate dummy for the next row
      }
    };
  }, [rows, rowSelectionModel]); // Added rowSelectionModel to the dependency array

  const columns: GridColDef[] = [
    {
      field: 'path',
      headerName: 'Path',
      flex: 1,
      renderCell: (params: GridCellParams) => (
        <a
          href="#"
          onClick={(e) => {
            e.stopPropagation(); // Prevent the event from bubbling up
            e.preventDefault();
            parent.postMessage({ pluginMessage: { type: 'navigate', nodeId: params.row.id } }, '*');
          }}
        >
          {params.value as string}
        </a>
      ),
    },
    { field: 'possibleDesigns', headerName: 'Variants', width: 100 },
    {
      field: 'textDummy',
      headerName: 'Dummy',
      width: 100,
      renderCell: (params) => {
        const hasTextNode = params.row.textNodeCount > 0;
        return (
          <TextField
            type="number"
            size="small"
            inputProps={{ min: 1, max: 100 }}
            value={params.row.textDummy || 1}
            disabled={!hasTextNode}
            onClick={(e) => e.stopPropagation()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTextDummyChange(e, params.row.id)}
          />
        );
      },
    },
    {
      field: 'totalDesigns',
      headerName: 'Total',
      width: 100,
      valueGetter: (params) =>
        (params.row.possibleDesigns || 1) * (params.row.textDummy || 1) * (params.row.textNodeCount || 1),
      renderCell: (params) => {
        const tooltipText = `Total Designs = Variants(${params.row.possibleDesigns || 1}) * Dummy(${params.row.textDummy || 1}) * Text Node Count(${params.row.textNodeCount || 1})`;
        return (
          <Tooltip title={tooltipText}>
            <Box>{params.value}</Box>
          </Tooltip>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      width: 100,
      renderCell: (params) => {
        const hasDocumentationLinks = params.row.documentationLinks.length > 0;
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
            <IconButton onClick={() => handleDelete(params.row.id)}>
              <DeleteIcon />
            </IconButton>
          </>
        );
      },
    },
  ];

  const CustomToolbar = () => {
    if (rowSelectionModel.length === 0) {
      return null;
    }

    return (
      <GridToolbarContainer style={{ justifyContent: 'flex-end' }}>
        <Button variant="text" color="primary" startIcon={<AutoFixHighIcon />} onClick={generateDummyForSelectedRows}>
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