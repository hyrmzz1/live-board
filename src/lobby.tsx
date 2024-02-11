import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import "./index.css"
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import CssBaseline from '@mui/material/CssBaseline';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Logout from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import imageSample from './image/imageSample.png';
import imageSample2 from './image/imageSample2.png'
import addButton from './image/addbutton.png'
import { ButtonBase } from '@mui/material';



const drawerWidth = 240;

interface AppBarProps extends MuiAppBarProps {
    open?: boolean;
}



const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
    open?: boolean;
}>(({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create('margin', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    ...(open && {
        transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: 0,
    }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    // necessary for content to be below app bar
    ...theme.mixins.toolbar,
    justifyContent: 'flex-end',
}));

const AppBar = styled(MuiAppBar, {
    shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
    transition: theme.transitions.create(['margin', 'width'], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    ...(open && {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: `${drawerWidth}px`,
        transition: theme.transitions.create(['margin', 'width'], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
        }),
    }),
}));

const Lobby = () => {

    // const [loggedIn, setLoggedIn] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { nickname } = location.state;
    // 서버요청해서 user목록 불러와야함. 
    // const [users, setUsers] = useState<User[]>([]);

    const theme = useTheme();
    const [open, setOpen] = React.useState(false);
    // const [loggedIn, setLoggedIn] = useState(false);

    const handleDrawerOpen = () => {
        setOpen(true);
    };

    const handleDrawerClose = () => {
        setOpen(false);
    };

    const handleEnter = (e: any) => {
        e.preventDefault();
        navigate('/app', { state: { nickname: nickname } })
    }

    const handleLogOut = () => {
        navigate('/', { state: { nickname: '' } })
    }




    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar position="fixed" open={open}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        onClick={handleDrawerOpen}
                        edge="start"
                        sx={{ mr: 2, ...(open && { display: 'none' }) }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div">
                        Live-Board
                    </Typography>
                </Toolbar>
            </AppBar>
            <Drawer
                sx={{
                    width: drawerWidth,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: drawerWidth,
                        boxSizing: 'border-box',
                    },
                }}
                variant="persistent"
                anchor="left"
                open={open}
            >
                <DrawerHeader>
                    <IconButton onClick={handleDrawerClose}>
                        {theme.direction === 'ltr' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                    </IconButton>
                </DrawerHeader>
                <Divider />
                <List>
                    {['Personal Project', 'Team Project'].map((text, index) => (
                        <ListItem key={text} disablePadding>
                            <ListItemButton>
                                <ListItemIcon>
                                    {index % 2 === 0 ? <PersonIcon /> : <GroupsIcon />}
                                </ListItemIcon>
                                <ListItemText primary={text} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
                <Divider />
                <List>
                    {['Logout'].map((text) => (
                        <ListItem key={text} disablePadding>
                            <ListItemButton onClick={handleLogOut}>
                                <ListItemIcon >
                                    <Logout />
                                </ListItemIcon>
                                <ListItemText primary={text} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Drawer>
            <Main open={open}>
                <DrawerHeader />
                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 5 }}>
                    <Card sx={{ maxWidth: 400 }}>
                        <ButtonBase onClick={handleEnter}>
                            <CardMedia
                                // 여기 방 썸네일 불러와야함
                                sx={{
                                    height: 300,
                                    width: '100%',
                                    objectFit: 'contain'
                                }}
                                component="img"
                                image={imageSample}
                                alt="Team2 PotatoField"
                            />
                        </ButtonBase>
                        <CardContent>
                            <Typography gutterBottom variant="h5" component="div">
                                Team2 PotatoField
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ maxWidth: 400 }}>
                        <ButtonBase >
                            <CardMedia
                                // 여기 방 썸네일 불러와야함
                                sx={{
                                    height: 300,
                                    width: '100%',
                                    objectFit: 'contain'
                                }}
                                component="img"
                                image={imageSample2}
                                alt="Team2 PotatoField"
                            />
                        </ButtonBase>
                        <CardContent>
                            <Typography gutterBottom variant="h5" component="div">
                                Drawing prac
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card sx={{ maxWidth: 400, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: 'none' }}>
                        <ButtonBase
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                height: 300, // Set a specific height for the ButtonBase
                                width: '100%',
                                '&:focus-visible': {  // This will remove the focus highlight/outline
                                    outline: 'none'
                                }
                            }}
                        >
                            <CardMedia
                                sx={{
                                    height: 100,
                                    width: '100%',
                                    objectFit: 'contain'
                                }}
                                component="img"
                                image={addButton}
                            />
                        </ButtonBase>
                        <CardContent>
                            <Typography fontSize={20} component="div">
                                New Project
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Main>
        </Box>
    );
}

export default Lobby;