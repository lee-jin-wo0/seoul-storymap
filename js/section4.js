/* =======================================================
   섹션 4 (역사의 현장) 지도 및 스크롤 로직
======================================================= */

async function initSection4Map() {
    const mapContainer = document.getElementById('map-s4');
    if (!mapContainer) return;

    // 1. 지도 초기화 (서울 중심부)
    const mapS4 = L.map('map-s4', {
        zoomControl: false,
        scrollWheelZoom: false
    }).setView([37.5680, 126.9830], 13); // 서울 시내 주요 지점이 잘 보이도록 중심 좌표 미세 조정

    // 라이트 테마 지도 타일 적용
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapS4);

    let mapTriggered = false; // 마커 애니메이션 중복 실행 방지

    try {
        // 2. GeoJSON 데이터 불러오기 (경로 수정 완료)
        const response = await fetch('./data/section.geojson');
        const geojsonData = await response.json();

        // 3. 지도가 화면에 보일 때 마커 생성 (IntersectionObserver)
        const observerS4 = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !mapTriggered) {
                    mapTriggered = true;
                    // ⭐ [여기에 추가!] 모바일 화면 변동 시 지도가 엉키지 않도록 크기 재계산
                    mapS4.invalidateSize();

                    let delay = 0; // 마커가 릴레이처럼 차례대로 켜지게 하는 딜레이 시간

                    geojsonData.features.forEach((feature) => {
                        const props = feature.properties;
                        const subId = String(props.SUB_ID);
                        const name = props.CONTENTS_NAME || "알 수 없는 장소";

                        // GeoJSON properties에서 COORD_Y(위도), COORD_X(경도) 직접 추출
                        if (!props.COORD_Y || !props.COORD_X) return; // 좌표가 없으면 건너뜀

                        const lat = parseFloat(props.COORD_Y);
                        const lng = parseFloat(props.COORD_X);
                        const latlng = [lat, lng];

                        let pulseClass = '';
                        // SUB_ID에 따른 클래스 부여 (3 = 중요지점/Red, 4 = 시위장소/Gold)
                        if (subId === '3') {
                            pulseClass = 'sc4-pulse-hub';
                        } else if (subId === '4') {
                            pulseClass = 'sc4-pulse-site';
                        }

                        // 조건에 맞는 데이터만 지도에 렌더링
                        if (pulseClass !== '') {
                            setTimeout(() => {
                                const icon = L.divIcon({
                                    className: 'sc4-marker-wrapper',
                                    html: `<div class="${pulseClass}"></div>`,
                                    iconSize: [24, 24],
                                    iconAnchor: [12, 12]
                                });

                                // 마커 추가 및 툴팁 바인딩
                                L.marker(latlng, { icon: icon })
                                    .addTo(mapS4)
                                    .bindTooltip(name, {
                                        direction: 'top',
                                        offset: [0, -10],
                                        className: 'custom-tooltip' // 공통 툴팁 CSS 사용
                                    });
                            }, delay);
                            delay += 150; // 0.15초 간격으로 마커가 팟! 팟! 팟! 등장
                        }
                    });
                }
            });
        }, { threshold: 0.3 }); // 지도가 화면에 30% 이상 나타나면 발동

        observerS4.observe(mapContainer);

    } catch (error) {
        console.error('Section 4 GeoJSON 로드 에러:', error);
    }

    // 4. 설명 페이지 및 범례 애니메이션 감지기
    const sc4RevealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });

    document.querySelectorAll('.sc4-reveal').forEach(el => sc4RevealObserver.observe(el));
}

document.addEventListener("DOMContentLoaded", () => {
    initSection4Map();
});