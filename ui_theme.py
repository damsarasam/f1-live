import streamlit as st
import streamlit.components.v1 as components

def apply_theme():
    # Inject CSS
    st.markdown("""
        <style>
        /* Global Background */
        .stApp { background-color: #050505; }
        
        /* Sidebar Background */
        [data-testid="stSidebar"] { background-color: #0c0c0c; border-right: 1px solid #FFD700; }

        /* All Text */
        html, body, [class*="css"] { color: #E0E0E0; font-family: 'Inter', sans-serif; }
        h1, h2, h3, h4, h5, h6 { color: #FFD700 !important; }

        /* Massive Interactive Buttons */
        .stButton>button {
            background-color: #1a1a1a; color: #FFD700; border: 2px solid #FFD700;
            border-radius: 12px; padding: 20px; font-size: 20px; font-weight: bold;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.2);
            width: 100%; height: auto;
        }
        .stButton>button:hover {
            background-color: #FFD700; color: #000000;
            transform: scale(1.1);
            box-shadow: 0 0 30px rgba(255, 215, 0, 0.6);
            z-index: 10;
        }

        /* Animated Tables */
        table { border-collapse: collapse; width: 100%; }
        tbody tr { transition: all 0.3s ease; border-bottom: 2px solid transparent !important; }
        tbody tr:hover { border-bottom: 2px solid #FFD700 !important; background-color: rgba(255, 215, 0, 0.05); }
        th { border-bottom: 1px solid #333 !important; }

        /* Vertical Line */
        .vertical-line {
            width: 4px; height: 100%; background-color: #FFFFFF;
            transition: all 0.4s ease; margin: 0 auto; min-height: 400px;
            border-radius: 2px;
        }
        .vertical-line:hover { background-color: #FFD700; box-shadow: 0 0 15px #FFD700; }

        /* Metric Cards */
        [data-testid="stMetric"] {
            background-color: #111111; border-left: 4px solid #FFD700; padding: 15px;
            border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        }
        
        /* Tabs */
        .stTabs [data-baseweb="tab-list"] { gap: 10px; }
        .stTabs [data-baseweb="tab"] { background-color: #111111; border-radius: 4px 4px 0 0; padding: 10px 20px; color: #A0A0A0; }
        .stTabs [aria-selected="true"] { background-color: #222222 !important; color: #FFD700 !important; border-bottom: 2px solid #FFD700 !important; }

        /* Inputs / Selectboxes */
        .stSelectbox div[data-baseweb="select"] > div { background-color: #111111; color: #E0E0E0; border: 1px solid #333333; }
        </style>
    """, unsafe_allow_html=True)
    
    # Inject Global Magical Cursor Javascript (Following Dot Style)
    components.html("""
        <script>
            const doc = window.parent.document;
            if (!doc.getElementById('magic-cursor-dot')) {
                // The main dot
                const dot = doc.createElement('div');
                dot.id = 'magic-cursor-dot';
                dot.style.position = 'fixed';
                dot.style.width = '8px';
                dot.style.height = '8px';
                dot.style.borderRadius = '50%';
                dot.style.backgroundColor = '#FFD700';
                dot.style.boxShadow = '0 0 10px #FFD700';
                dot.style.pointerEvents = 'none';
                dot.style.zIndex = '999999';
                dot.style.transform = 'translate(-50%, -50%)';
                doc.body.appendChild(dot);
                
                // The trailing ring
                const ring = doc.createElement('div');
                ring.id = 'magic-cursor-ring';
                ring.style.position = 'fixed';
                ring.style.width = '35px';
                ring.style.height = '35px';
                ring.style.borderRadius = '50%';
                ring.style.border = '2px solid rgba(255, 215, 0, 0.4)';
                ring.style.pointerEvents = 'none';
                ring.style.zIndex = '999998';
                ring.style.transform = 'translate(-50%, -50%)';
                ring.style.transition = 'width 0.2s, height 0.2s, background-color 0.2s';
                doc.body.appendChild(ring);
                
                let mouseX = 0, mouseY = 0;
                let ringX = 0, ringY = 0;
                
                doc.addEventListener('mousemove', (e) => {
                    mouseX = e.clientX;
                    mouseY = e.clientY;
                    dot.style.left = mouseX + 'px';
                    dot.style.top = mouseY + 'px';
                });
                
                function animate() {
                    ringX += (mouseX - ringX) * 0.15;
                    ringY += (mouseY - ringY) * 0.15;
                    ring.style.left = ringX + 'px';
                    ring.style.top = ringY + 'px';
                    requestAnimationFrame(animate);
                }
                animate();
                
                // Make the ring shrink on click
                doc.addEventListener('mousedown', () => {
                    ring.style.width = '15px'; 
                    ring.style.height = '15px';
                    ring.style.backgroundColor = 'rgba(255, 215, 0, 0.3)';
                });
                doc.addEventListener('mouseup', () => {
                    ring.style.width = '35px'; 
                    ring.style.height = '35px';
                    ring.style.backgroundColor = 'transparent';
                });
            }
        </script>
    """, height=0, width=0)
