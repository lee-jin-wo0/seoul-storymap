// 1. 섹션 3 전용: 카드 스크롤 진입/이탈 감지기
const sc3RevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        } else {
            entry.target.classList.remove('active');
        }
    });
}, { threshold: 0.4, rootMargin: "0px 0px -10% 0px" });

// 2. 섹션 3 GeoJSON 연동 및 스크롤 맵 로직
async function initSection3Map() {
    const mapContainer = document.getElementById('map-s3');
    if (!mapContainer) return;

    const mapS3 = L.map('map-s3', { zoomControl: false, scrollWheelZoom: false }).setView([37.5665, 126.9780 - 0.01], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapS3);

    let activeGeoJsonLayer = null;
    let activeMarkers = [];

    const sc3Groups = [
        { id: 'east-1', targetIds: ["52"] },
        { id: 'east-2', targetIds: ["50"] },
        { id: 'west-1', targetIds: ["51"] },
        { id: 'west-2', targetIds: ["53"] },
        { id: 'west-3', targetIds: ["49"] },
        { id: 'march5-1', targetIds: ["48"] },
        { id: 'march5-2', targetIds: ["47"] }
    ];

    try {
        const response = await fetch('./data/section3.geojson');
        const sc3Data = await response.json();

        const timelineList = document.getElementById('sc3-timeline-list');
        timelineList.innerHTML = '';

        // HTML 카드 동적 생성
        sc3Groups.forEach(group => {
            const feature = sc3Data.features.find(f => String(f.id) === group.targetIds[0]);

            if (feature) {
                const props = feature.properties;
                const title = props.CONTENTS_NAME || "제목 없음";
                const name1 = props.NAME_01 || "";
                const val1 = props.VALUE_01 || "";
                const name2 = props.NAME_02 || "";
                const val2 = props.VALUE_02 ? props.VALUE_02.replace(/\n/g, '<br>') : "";

                const cardHTML = `
                    <div class="sc3-timeline-item sc3-scroll-reveal" data-feature-id="${group.targetIds[0]}">
                        <h3 class="sc3-item-title">${title}</h3>
                        
                        ${(name1 || val1) ? `
                        <div class="sc3-route-box">
                            ${name1 ? `<strong class="sc3-route-label">${name1}</strong>` : ''}
                            <p class="sc3-route-val">${val1}</p>
                        </div>
                        ` : ''}
                        
                        ${(name2 || val2) ? `
                        <div class="sc3-desc-box">
                            ${name2 ? `<strong class="sc3-route-label">${name2}</strong>` : ''}
                            <p class="sc3-item-desc">${val2}</p>
                        </div>
                        ` : ''}
                    </div>
                `;
                timelineList.insertAdjacentHTML('beforeend', cardHTML);
            }
        });

        document.querySelectorAll('.sc3-scroll-reveal').forEach(el => sc3RevealObserver.observe(el));

        // 스크롤 감지 로직 - 지도 선 제어 및 애니메이션
        const mapUpdateObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const featureId = entry.target.getAttribute('data-feature-id');
                    const targetFeature = sc3Data.features.find(f => String(f.id) === featureId);

                    // 기존에 그려진 선 및 마커 지우기
                    if (activeGeoJsonLayer) {
                        mapS3.removeLayer(activeGeoJsonLayer);
                    }
                    activeMarkers.forEach(m => mapS3.removeLayer(m));
                    activeMarkers = [];

                    // 새로운 선 지도에 그리기
                    if (targetFeature) {
                        activeGeoJsonLayer = L.geoJSON(targetFeature, {
                            style: {
                                color: '#000000',
                                weight: 6,
                                opacity: 0.9,
                                lineJoin: 'round',
                                className: 'sc3-draw-path'
                            }
                        }).addTo(mapS3);
                        // ⭐ [수정된 부분] 카드가 있는 '왼쪽' 공간을 크게 비워두어 선을 오른쪽으로 밀어냅니다.
                        mapS3.invalidateSize();

                        // 1. 현재 화면 너비 확인 (예: 768px 이하를 모바일로 간주)
                        const isMobile = window.innerWidth <= 768;

                        let padTopLeft, padBottomRight;

                        if (isMobile) {
                            // 📱 [모바일 환경] 
                            // 가로 폭이 좁으므로 왼쪽 여백은 기본(예: 30)으로 줄입니다.
                            // 만약 모바일에서 텍스트 카드가 '지도 아래쪽'에 뜬다면, 아래 여백(bottom)을 주어 지도를 위로 올립니다.
                            padTopLeft = [30, 30];         // [왼쪽 여백, 위 여백]
                            padBottomRight = [30, 150];    // [오른쪽 여백, 아래 여백] - 필요에 따라 150이라는 숫자를 조절하세요.
                        } else {
                            // 💻 [데스크톱 환경] 
                            // 카드가 왼쪽에 있으므로 기존처럼 왼쪽 여백을 크게 줍니다.
                            padTopLeft = [450, 50];        // [왼쪽 여백, 위 여백]
                            padBottomRight = [50, 50];     // [오른쪽 여백, 아래 여백]
                        }

                        // 2. 조건에 맞게 계산된 패딩 적용
                        mapS3.fitBounds(activeGeoJsonLayer.getBounds(), {
                            paddingTopLeft: padTopLeft,
                            paddingBottomRight: padBottomRight,
                            maxZoom: 16
                        });

                        // 출발점, 도착점 마커 생성 로직
                        let lineCoords = [];
                        if (targetFeature.geometry.type === 'GeometryCollection') {
                            const lineStringGeo = targetFeature.geometry.geometries.find(g => g.type === 'LineString');
                            if (lineStringGeo) lineCoords = lineStringGeo.coordinates;
                        } else if (targetFeature.geometry.type === 'LineString') {
                            lineCoords = targetFeature.geometry.coordinates;
                        }

                        if (lineCoords.length > 0) {
                            const startCoord = [lineCoords[0][1], lineCoords[0][0]];
                            const endCoord = [lineCoords[lineCoords.length - 1][1], lineCoords[lineCoords.length - 1][0]];

                            const startIcon = L.divIcon({
                                className: 'sc3-point-marker start',
                                html: '<div class="sc3-point-label">출발</div><div class="sc3-point-dot"></div>',
                                iconSize: [40, 40], iconAnchor: [20, 40]
                            });

                            const endIcon = L.divIcon({
                                className: 'sc3-point-marker end',
                                html: '<div class="sc3-point-label">도착</div><div class="sc3-point-dot"></div>',
                                iconSize: [40, 40], iconAnchor: [20, 40]
                            });

                            activeMarkers.push(L.marker(startCoord, { icon: startIcon }).addTo(mapS3));
                            activeMarkers.push(L.marker(endCoord, { icon: endIcon }).addTo(mapS3));
                        }

                        // 선 스르륵 그려지는 애니메이션
                        setTimeout(() => {
                            const paths = document.querySelectorAll('.sc3-draw-path');
                            paths.forEach(path => {
                                const length = path.getTotalLength();
                                path.style.strokeDasharray = length;
                                path.style.strokeDashoffset = length;
                                path.getBoundingClientRect();
                                path.style.transition = 'stroke-dashoffset 2.5s ease-in-out';
                                path.style.strokeDashoffset = '0';
                            });
                        }, 0);
                    }
                }
            });
        }, { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" });

        document.querySelectorAll('.sc3-timeline-item').forEach(item => mapUpdateObserver.observe(item));

    } catch (error) {
        console.error('Section 3 GeoJSON 로드 에러:', error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initSection3Map();
});