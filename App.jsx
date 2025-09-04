import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import {
    Alert,
    AppBar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    Link,
    List,
    ListItem,
    ListItemText,
    Paper,
    Snackbar,
    Stack,
    TextField,
    Toolbar,
    Tooltip,
    Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";


const LOG_KEY = "urlshort_logs";
const Logger = {
    log(type, payload = {}) {
        const prev = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
        const entry = { id: crypto.randomUUID(), ts: new Date().toISOString(), type, payload };
        prev.push(entry);
        localStorage.setItem(LOG_KEY, JSON.stringify(prev));
        return entry;
    },
    all() {
        return JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    },
    clear() {
        localStorage.setItem(LOG_KEY, JSON.stringify([]));
    },
};


const STORE_KEY = "urlshort_links_v1";

function loadStore() {
    try {
        return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch (e) {
        return {};
    }
}
function saveStore(obj) {
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
}


function isValidUrl(value) {
    try {
        const u = new URL(value);
        return !!u.protocol && !!u.host;
    } catch (e) {
        return false;
    }
}

function randomCode(len = 6) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    const cryptoObj = window.crypto || window.msCrypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
        const arr = new Uint8Array(len);
        cryptoObj.getRandomValues(arr);
        for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
        return out;
    }
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

function now() {
    return Date.now();
}


function reducer(state, action) {
    switch (action.type) {
        case "INIT": {
            return { ...state, links: action.links };
        }
        case "ADD_LINK": {
            const links = { ...state.links, [action.record.code]: action.record };
            saveStore(links);
            Logger.log("LINK_CREATED", { code: action.record.code, url: action.record.url, expiresAt: action.record.expiresAt });
            return { ...state, links };
        }
        case "DELETE_LINK": {
            const { code } = action;
            const links = { ...state.links };
            delete links[code];
            saveStore(links);
            Logger.log("LINK_DELETED", { code });
            return { ...state, links };
        }
        case "CLICK": {
            const { code } = action;
            const rec = state.links[code];
            if (!rec) return state;
            const updated = { ...rec, clicks: rec.clicks + 1 };
            const links = { ...state.links, [code]: updated };
            saveStore(links);
            Logger.log("LINK_CLICK", { code });
            return { ...state, links };
        }
        default:
            return state;
    }
}

function useLinksStore() {
    const [state, dispatch] = useReducer(reducer, { links: {} });
    useEffect(() => {
        dispatch({ type: "INIT", links: loadStore() });
    }, []);
    const value = useMemo(() => ({ state, dispatch }), [state]);
    return value;
}

function Redirector({ dispatch, links }) {
    const { code = "" } = useParams();
    const [status, setStatus] = useState("processing");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const record = links[code];
        if (!record) {
            setStatus("error");
            setMessage("Short link not found.");
            Logger.log("REDIRECT_FAIL_NOT_FOUND", { code });
            return;
        }
        if (record.expiresAt && now() > record.expiresAt) {
            setStatus("error");
            setMessage("This short link has expired.");
            Logger.log("REDIRECT_FAIL_EXPIRED", { code });
            return;
        }
       
        dispatch({ type: "CLICK", code });
        Logger.log("REDIRECT_SUCCESS", { code, to: record.url });
        window.location.replace(record.url);
    }, [code, dispatch, links]);

    if (status === "processing") return null;
    return (
        <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Card>
                <CardContent>
                    <Typography variant="h5" gutterBottom>
                        Redirection Error
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                        {message}
                    </Typography>
                    <Button component={RouterLink} to="/" variant="contained">Go to Home</Button>
                </CardContent>
            </Card>
        </Container>
    );
}

function UrlRow({ idx, value, onChange, existingCodes }) {
    const [err, setErr] = useState(null);

    function validate(newVal) {
        const { url, code, minutes } = newVal;
        if (!url) return setErr(null);
        if (!isValidUrl(url)) return setErr("Enter a valid URL (with http/https)");
        if (code && !/^[-a-zA-Z0-9]+$/.test(code)) return setErr("Shortcode must be alphanumeric or hyphen");
        if (code && existingCodes.includes(code)) return setErr("Shortcode already in use");
        if (minutes !== "" && (!Number.isInteger(Number(minutes)) || Number(minutes) <= 0)) return setErr("Validity must be a positive integer (minutes)");
        setErr(null);
    }

    useEffect(() => validate(value), [value]);

    return (
        <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label={`Long URL #${idx + 1}`}
                            placeholder="https://example.com/some/very/long/url"
                            value={value.url}
                            onChange={(e) => onChange({ ...value, url: e.target.value })}
                            error={!!err && !value.url ? false : !!err}
                            helperText={err}
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField
                            fullWidth
                            label="Custom shortcode (optional)"
                            value={value.code}
                            onChange={(e) => onChange({ ...value, code: e.target.value.trim() })}
                            InputProps={{ startAdornment: <InputAdornment position="start">/</InputAdornment> }}
                        />
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <TextField
                            fullWidth
                            label="Validity (minutes)"
                            placeholder="30 (default)"
                            value={value.minutes}
                            onChange={(e) => onChange({ ...value, minutes: e.target.value.replace(/[^0-9]/g, "") })}
                        />
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
}
function Home({ state, dispatch }) {
    const navigate = useNavigate();
    const [rows, setRows] = useState([
        { url: "", code: "", minutes: "" },
    ]);
    const [toast, setToast] = useState("");

    const existingCodes = useMemo(() => Object.keys(state.links), [state.links]);

    function setRow(i, val) {
        const copy = [...rows];
        copy[i] = val;
        setRows(copy);
    }

    function addRow() {
        if (rows.length >= 5) return setToast("You can only submit up to 5 URLs at once.");
        setRows([...rows, { url: "", code: "", minutes: "" }]);
    }

    function remove(code) {
        dispatch({ type: "DELETE_LINK", code });
        setToast("Short link deleted");
    }

    function createAll() {
        
        const creations = [];
        for (const r of rows) {
            if (!r.url) continue; 
            if (!isValidUrl(r.url)) {
                setToast("One or more URLs are invalid.");
                return;
            }
            let code = r.code || randomCode(6);
            if (!/^[-a-zA-Z0-9]+$/.test(code)) {
                setToast("Custom shortcode must be alphanumeric or hyphen.");
                return;
            }
        
            let attempts = 0;
            while (existingCodes.includes(code) || creations.some((c) => c.code === code)) {
                if (r.code) {
                    setToast(`Shortcode \\"${code}\\" already exists.`);
                    return;
                }
                code = randomCode(6);
                attempts++;
                if (attempts > 10) break;
            }
            const minutes = r.minutes === "" ? 30 : Number(r.minutes);
            if (!Number.isInteger(minutes) || minutes <= 0) {
                setToast("Validity must be a positive integer (minutes)");
                return;
            }
            const createdAt = now();
            const expiresAt = createdAt + minutes * 60 * 1000;
            creations.push({ code, url: r.url, createdAt, expiresAt, clicks: 0 });
        }

        if (creations.length === 0) {
            setToast("Nothing to create. Add at least one valid URL.");
            return;
        }
        for (const rec of creations) {
            dispatch({ type: "ADD_LINK", record: rec });
        }
        setRows([{ url: "", code: "", minutes: "" }]);
        setToast(`${creations.length} short link(s) created`);
    }

    const base = window.location.origin;

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Paper elevation={3} sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h5">URL Shortener</Typography>
                    <Button startIcon={<AddIcon />} onClick={addRow} variant="outlined">Add Row</Button>
                </Stack>
                {rows.map((r, i) => (
                    <UrlRow key={i} idx={i} value={r} onChange={(v) => setRow(i, v)} existingCodes={existingCodes} />
                ))}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <Button onClick={createAll} variant="contained">Create Short Links</Button>
                    <Button onClick={() => navigate("/logs")} variant="text">View Logs</Button>
                </Stack>
            </Paper>

            <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                    Your Links
                </Typography>
                <List>
                    {Object.values(state.links)
                        .sort((a, b) => b.createdAt - a.createdAt)
                        .map((rec) => {
                            const shortUrl = `${base}/${rec.code}`;
                            const expired = now() > rec.expiresAt;
                            return (
                                <ListItem key={rec.code} secondaryAction={
                                    <Stack direction="row" spacing={1}>
                                        <Tooltip title="Copy">
                                            <IconButton edge="end" onClick={() => {
                                                navigator.clipboard.writeText(shortUrl).then(() => setToast("Copied"));
                                            }}>
                                                <ContentCopyIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Open">
                                            <IconButton edge="end" component="a" href={shortUrl} target="_blank" rel="noopener noreferrer">
                                                <OpenInNewIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton edge="end" onClick={() => remove(rec.code)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                }>
                                    <ListItemText
                                        primary={
                                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center">
                                                <Link component={RouterLink} to={`/${rec.code}`}>{shortUrl}</Link>
                                                {expired ? (
                                                    <Chip label="Expired" color="error" size="small" />
                                                ) : (
                                                    <Chip label={`Valid until ${new Date(rec.expiresAt).toLocaleString()}`} size="small" />
                                                )}
                                            </Stack>
                                        }
                                        secondary={
                                            <>
                                                <Typography variant="body2">→ {rec.url}</Typography>
                                                <Typography variant="caption">Clicks: {rec.clicks} • Created {new Date(rec.createdAt).toLocaleString()}</Typography>
                                            </>
                                        }
                                    />
                                </ListItem>
                            );
                        })}
                </List>
            </Box>

            <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast("")}>
                <Alert severity="info" onClose={() => setToast("")}>{toast}</Alert>
            </Snackbar>
        </Container>
    );
}

function LogsPage() {
    const [logs, setLogs] = useState(Logger.all().reverse());
    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h5">Application Logs</Typography>
                <Button variant="outlined" onClick={() => { Logger.clear(); setLogs([]); }}>Clear</Button>
            </Stack>
            <List>
                {logs.map((l) => (
                    <ListItem key={l.id} alignItems="flex-start">
                        <ListItemText
                            primary={<>
                                <Typography variant="subtitle2">{l.type}</Typography>
                                <Typography variant="caption">{new Date(l.ts).toLocaleString()}</Typography>
                            </>}
                            secondary={<pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(l.payload, null, 2)}</pre>}
                        />
                    </ListItem>
                ))}
            </List>
            {logs.length === 0 && <Alert severity="info">No logs yet. Perform some actions in the app.</Alert>}
        </Container>
    );
}


export default function App() {
    const { state, dispatch } = useLinksStore();
    return (
        <BrowserRouter>
            <AppBar position="static">
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1 }} component={RouterLink} to="/" style={{ textDecoration: "none", color: "inherit" }}>
                        URL Shortener (MUI)
                    </Typography>
                    <Button component={RouterLink} to="/" color="inherit">Home</Button>
                    <Button component={RouterLink} to="/logs" color="inherit">Logs</Button>
                </Toolbar>
            </AppBar>
            <Routes>
                <Route path="/" element={<Home state={state} dispatch={dispatch} />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route path=":code" element={<Redirector links={state.links} dispatch={dispatch} />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
            <Footer />
        </BrowserRouter>
    );
}

function NotFound() {
    return (
        <Container maxWidth="sm" sx={{ mt: 8 }}>
            <Alert severity="warning">Page not found.</Alert>
            <Button component={RouterLink} to="/" sx={{ mt: 2 }} variant="contained">Go Home</Button>
        </Container>
    );
}

function Footer() {
    return (
        <Box component="footer" sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="caption">
                Default validity is 30 minutes. Styling powered by Material UI. No console logging used; view logs in the Logs page.
            </Typography>
        </Box>
    );
}
