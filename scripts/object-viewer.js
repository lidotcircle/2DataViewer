import van from "./thirdparty/van.js";
import jss from "./thirdparty/jss.js";
import { genStyle } from "./core/common.js";


class ObjectViewer {
    constructor() {
        this.m_objects = van.reactive([]);
        this.m_objectCount = van.state(0);
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
                padding: "0.5em",
                "border-radius": "0.2em",
                margin: [0],
            },
            objectViewerItem: {
                "padding": "0em 0.5em",
            },
        }).attach();
        this.m_classes = classes;
        this.m_show = van.state(true);
    }

    sanitizeObj(obj) {
        const xobj = {};
        Object.getOwnPropertyNames(obj).forEach((key) => {
            if (key != "m_shape") {
                if (typeof (obj[key]) == "object") {
                    xobj[key] = this.sanitizeObj(obj[key]);
                } else {
                    xobj[key] = obj[key];
                }
            }
        });
        return xobj;
    }

    showObjects(objs) {
        this.m_objects.splice(0);
        for (const obj of objs) {
            const xobj = this.sanitizeObj(obj);
            this.m_objects.push(van.noreactive(xobj));
        }
        this.m_objectCount.val = this.m_objects.length;
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
            van.tags.ul(
                { class: `${this.m_classes.objectViewerList}` },
                () => van.tags.div(
                    {
                        style: genStyle({
                            padding: "1em 0.5em",
                        }),
                    },
                    `${this.m_objectCount.val} objects selected`),
            ),
            this.m_objects || [],
            o => {
                return van.tags.li(
                    { class: `${this.m_classes.objectViewerItem}` },
                    van.tags.pre({ style: "margin: 0em" }, JSON.stringify(van.getRawObject(o), null, 2)));
            }));
    }
}

export { ObjectViewer };
