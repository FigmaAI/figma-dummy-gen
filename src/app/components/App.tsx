import React, { useEffect, useState } from 'react';
import { Button, IconButton, Box, TextField, Typography } from '@mui/material';
import { DataGrid, GridRowSelectionModel, GridToolbarContainer, GridColDef, GridCellParams, GridToolbar } from '@mui/x-data-grid';
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
    const newDummyValue = Number(e.target.value);
    const updatedRows = rows.map((row) => {
      if (row.id === id) {
        return { ...row, textDummy: newDummyValue };
      }
      return row;
    });
    setRows(updatedRows);
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
            documentationLinks: item.documentationLinks,
            nestedInstanceDesignCount: item.nestedInstanceDesignCount,
            textDummy: item.textDummy,
            hasTextVariant: item.hasTextVariant,
            textNodeCount: item.textNodeCount,
          };
        });
        setRows(updatedRows);
      } else if (type === 'gen-dummy-done' && nodeId) {
        
        // remove the row from the table
        handleDelete(nodeId);

        // remove the selected row from the selection model
        setRowSelectionModel(rowSelectionModel.filter((id) => id !== nodeId));


        // if there are more rows to process, generate dummy for the next row
        if (rowSelectionModel.length > 0) {
          generateDummyForSelectedRows();
        }
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
    { field: 'possibleDesigns', headerName: 'Variants', width: 80 },
    {
      field: 'textDummy',
      headerName: 'Dummy',
      width: 104,
      renderCell: (params) => {
        if (!params.row.hasTextVariant) {
          return null;
        }
        return (
          <TextField
            type="number"
            size="small"
            fullWidth
            inputProps={{ min: 1, max: 100 }}
            value={params.row.textDummy || 1}
            onClick={(e) => e.stopPropagation()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTextDummyChange(e, params.row.id)}
            InputProps={{
              endAdornment: params.row.textNodeCount && (
                <Typography variant="caption" color="disabled">
                  &times; {params.row.textNodeCount}
                </Typography>
              ),
            }}
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      sortable: false,
      width: 96,
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
      return <GridToolbar showQuickFilter={true} />;
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