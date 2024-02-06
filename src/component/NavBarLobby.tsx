import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import teamLogoImg from '../assets/PotatoFieldLogoSquare.png';

export default function NavBar() {
    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static">
                <Toolbar>
                    <img className='TeamLogo' src={teamLogoImg} alt='team logo image' style={{ width: '48px', height: '48px' }}/>
                    <Typography
                        variant="h6"
                        noWrap
                        component="div"
                        sx={{ display: { xs: 'none', sm: 'block' } }}
                        ml={2}
                        color={'black'}
                        fontWeight={'700'}
                    >
                        Live Board
                    </Typography>
                </Toolbar>
            </AppBar>
        </Box>
    );
}