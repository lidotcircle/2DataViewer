function logo_svg(strokeColor = "#44aed1", fillColor = "#bae7f6") {
    return `
<svg viewBox="-20 -20 240 240" width="240" height="240" preserveAspectRatio="xMidYMid meet">
<path d="M0,0 L25,0 L25,175 L200,175 L200,200 L0,200 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="0"/>
<path d="M0,0 L25,0" stroke="${strokeColor}" stroke-width="8"/>
<path d="M25,0 L25,175" stroke="${strokeColor}" stroke-width="8"/>
<path d="M25,175 L200,175" stroke="${strokeColor}" stroke-width="8"/>
<path d="M200,175 L200,200" stroke="${strokeColor}" stroke-width="8"/>
<path d="M200,200 L0,200" stroke="${strokeColor}" stroke-width="8"/>
<path d="M0,200 L0,0" stroke="${strokeColor}" stroke-width="8"/>
<circle cx="0" cy="0" r="4" fill="${strokeColor}"/>
<circle cx="25" cy="0" r="4" fill="${strokeColor}"/>
<circle cx="25" cy="175" r="4" fill="${strokeColor}"/>
<circle cx="200" cy="175" r="4" fill="${strokeColor}"/>
<circle cx="200" cy="200" r="4" fill="${strokeColor}"/>
<circle cx="0" cy="200" r="4" fill="${strokeColor}"/>

<path d="M13,20 L25,20" stroke="${strokeColor}" stroke-width="8"/>
<path d="M13,40 L25,40" stroke="${strokeColor}" stroke-width="8"/>
<path d="M13,60 L25,60" stroke="${strokeColor}" stroke-width="8"/>
<path d="M13,80 L25,80" stroke="${strokeColor}" stroke-width="8"/>
<path d="M13,100 L25,100" stroke="${strokeColor}" stroke-width="8"/>
<path d="M13,120 L25,120" stroke="${strokeColor}" stroke-width="8"/>
<path d="M13,140 L25,140" stroke="${strokeColor}" stroke-width="8"/>
<circle cx="13" cy="20" r="4" fill="${strokeColor}"/>
<circle cx="13" cy="40" r="4" fill="${strokeColor}"/>
<circle cx="13" cy="60" r="4" fill="${strokeColor}"/>
<circle cx="13" cy="80" r="4" fill="${strokeColor}"/>
<circle cx="13" cy="100" r="4" fill="${strokeColor}"/>
<circle cx="13" cy="120" r="4" fill="${strokeColor}"/>
<circle cx="13" cy="140" r="4" fill="${strokeColor}"/>

<path d="M60,188 L60,175" stroke="${strokeColor}" stroke-width="8"/>
<path d="M80,188 L80,175" stroke="${strokeColor}" stroke-width="8"/>
<path d="M100,188 L100,175" stroke="${strokeColor}" stroke-width="8"/>
<path d="M120,188 L120,175" stroke="${strokeColor}" stroke-width="8"/>
<path d="M140,188 L140,175" stroke="${strokeColor}" stroke-width="8"/>
<path d="M160,188 L160,175" stroke="${strokeColor}" stroke-width="8"/>
<path d="M180,188 L180,175" stroke="${strokeColor}" stroke-width="8"/>
<circle cx="60" cy="188" r="4" fill="${strokeColor}"/>
<circle cx="80" cy="188" r="4" fill="${strokeColor}"/>
<circle cx="100" cy="188" r="4" fill="${strokeColor}"/>
<circle cx="120" cy="188" r="4" fill="${strokeColor}"/>
<circle cx="140" cy="188" r="4" fill="${strokeColor}"/>
<circle cx="160" cy="188" r="4" fill="${strokeColor}"/>
<circle cx="180" cy="188" r="4" fill="${strokeColor}"/>

<path d="M25,175 L12,188" stroke="${strokeColor}" stroke-width="8"/>
<circle cx="12" cy="188" r="4" fill="${strokeColor}"/>

<g transform="scale(1.15,1.15), translate(25, -5)">
<polygon 
points="75,15 125,50 125,100 75,135 25,100 25,50"
fill="${fillColor}"
stroke="black"
stroke-width="0"
/>

<circle cx="75" cy="15" r="4" fill="${strokeColor}"/>
<circle cx="125" cy="50" r="4" fill="${strokeColor}"/>
<circle cx="125" cy="100" r="4" fill="${strokeColor}"/>
<circle cx="75" cy="135" r="4" fill="${strokeColor}"/>
<circle cx="25" cy="100" r="4" fill="${strokeColor}"/>
<circle cx="25" cy="50" r="4" fill="${strokeColor}"/>

<path d="M75,85 L25,50" stroke="${strokeColor}" stroke-width="8"/>
<path d="M75,85 L125,50" stroke="${strokeColor}" stroke-width="8"/>
<path d="M75,85 L75,135" stroke="${strokeColor}" stroke-width="8"/>
<path d="M75,15 L125,50" stroke="${strokeColor}" stroke-width="8"/>
<path d="M125,50 L125,100" stroke="${strokeColor}" stroke-width="8"/>
<path d="M125,100 L75,135" stroke="${strokeColor}" stroke-width="8"/>
<path d="M75,135 L25,100" stroke="${strokeColor}" stroke-width="8"/>
<path d="M25,100 L25,50" stroke="${strokeColor}" stroke-width="8"/>
<path d="M25,50 L75,15" stroke="${strokeColor}" stroke-width="8"/>
</g>

</svg>
`;
}

export { logo_svg }
