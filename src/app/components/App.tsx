// App.tsx
import React from 'react';
import { List, ListItem, ListItemText, AppBar, Toolbar, Typography, IconButton, Box } from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';

function App() {
  const [rows, setRows] = React.useState([]);

  const getComponentSet = () => {
    parent.postMessage({ pluginMessage: { type: 'get-component-set' } }, '*');
  };

  React.useEffect(() => {
    window.onmessage = (event) => {
      const { type, data } = event.data.pluginMessage;
      if (type === 'component-set-data') {
        setRows(data);
      }
    };
  }, []);

  return (
    <div style={{ paddingBottom: '56px' }}>
      <List>
        {rows.map((item, index) => (
          <ListItem key={index}>
            <Box border={1} borderRadius={4} p={1} width="100%">
              <ListItemText primary={item.name} secondary={`Properties: ${item.componentPropertyDefinitions ? Object.keys(item.componentPropertyDefinitions).length : 0}`} />
            </Box>
          </ListItem>
        ))}
      </List>
      <AppBar position="fixed" color="primary" style={{ top: 'auto', bottom: 0 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Total Items: {rows.length}
          </Typography>
          <IconButton color="inherit" onClick={getComponentSet}>
            <CloudSyncIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
    </div>
  );
}

export default App;