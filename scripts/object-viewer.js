import van from "./thirdparty/van.js";
import jss from "./thirdparty/jss.js";


class ObjectViewer {
    constructor(objects) {
        this.m_objects = objects;
        const { classes } = jss.createStyleSheet({
            objectViewerContainer: {
                position: "absolute",
                "max-width": "30%",
                "max-height": "80%",
                top: "5%",
                left: "5%",
                "overflow-y": "scroll",
                "&::-webkit-scrollbar": {
                    width: "0.3em",
                    height: "0.3em",
                    "background-color": "transparent"
                },
                "&::-webkit-scrollbar-thumb": {
                    "background-color": "rgba(180, 180, 180, 0)",
                    "border-radius": "0.2em",
                },
                "&:hover": {
                    "&::-webkit-scrollbar-thumb": {
                        "background-color": "rgba(180, 180, 180, 0.7)",
                    }
                },
            },
            objectViewerHide: {
                display: "none",
            },
            objectViewerList: {
                width: "max-content",
                "min-width": "100%",
                background: "RGBA(255, 255, 255, 0.5)",
                position: "relative",
                "z-index": "999",
                padding: "0.5em",
                "border-radius": "0.2em",
                margin: [0],

            },
            objectViewerItem: {
                "padding": "10px",
            },
        }).attach();
        this.m_classes = classes;
        this.m_show = van.state(true);
    }

    toggle() {
        this.m_show.val = !this.m_show.val;
    }

    /** @param {HTMLElement} dom */
    render(dom) {
        if (dom) {
            if (this.m_show.val != this.m_show._oldVal) {
                dom.classList.toggle(this.m_classes.objectViewerHide, !this.m_show.val);
            }
            return dom;
        }
        const hideClass = this.m_show.val ? '' : " " + this.m_classes.objectViewerHide;
        return van.tags.div({ class: `${this.m_classes.objectViewerContainer}${hideClass}` }, van.list(
            van.tags.ul({ class: `${this.m_classes.objectViewerList}` }),
            this.m_objects || [],
            o => {
                return van.tags.li(
                    { class: `${this.m_classes.objectViewerItem}` },
                    JSON.stringify(van.getRawObject(o)));
            }));
    }
}

export { ObjectViewer };
