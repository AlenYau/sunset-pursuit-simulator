using System;

namespace SunsetPursuit
{
    [Serializable] public sealed class GeographyData
    {
        public Country[] countries;
        public SeaArea[] seas;
    }
    [Serializable] public sealed class Country
    {
        public string n,iso;
        public GeoPiece[] p;
    }
    [Serializable] public sealed class SeaArea
    {
        public string n;
        public double a;
        public GeoPiece[] p;
    }
    [Serializable] public sealed class GeoPiece
    {
        public double[] b,v;
        public int[] o;
    }

    public static class Geography
    {
        private static bool InRing(double lon,double lat,GeoPiece piece,int ring)
        {
            int start=piece.o[ring],end=piece.o[ring+1];bool inside=false;
            for(int i=start,j=end-1;i<end;j=i++)
            {
                double ax=piece.v[i*2],ay=piece.v[i*2+1];
                double bx=piece.v[j*2],by=piece.v[j*2+1];
                if((ay>lat)!=(by>lat) && lon<(bx-ax)*(lat-ay)/(by-ay)+ax)inside=!inside;
            }
            return inside;
        }

        private static GeoPiece Containing(double lon,double lat,GeoPiece[] pieces)
        {
            if(pieces==null)return null;
            foreach(var piece in pieces)
            {
                if(lat<piece.b[1]||lat>piece.b[3])continue;
                foreach(double x in new[]{lon,lon-360,lon+360})
                {
                    if(x<piece.b[0]||x>piece.b[2]||!InRing(x,lat,piece,0))continue;
                    bool hole=false;
                    for(int ring=1;ring<piece.o.Length-1;ring++)if(InRing(x,lat,piece,ring)){hole=true;break;}
                    if(!hole)return piece;
                }
            }
            return null;
        }

        public static string Lookup(GeographyData data,double lat,double lon)
        {
            if(data==null||double.IsNaN(lat)||double.IsNaN(lon))return "位置未知";
            lon=SimulationCore.NormalizeLongitude(lon);
            foreach(var country in data.countries)
            {
                var piece=Containing(lon,lat,country.p);
                if(piece==null)continue;
                if(country.iso=="US"&&lat>50&&lon< -130)return "美國阿拉斯加";
                if(country.iso=="US"&&lat<25&&lon< -150)return "美國夏威夷";
                double west=piece.b[0],south=piece.b[1],east=piece.b[2],north=piece.b[3];
                if(east-west<1.5||north-south<1.5)return country.n;
                double x=(lon+360*Math.Round(((west+east)*.5-lon)/360)-west)/(east-west);
                double y=(lat-south)/(north-south);
                string vertical=y>.60?"北":y<.36?"南":"";
                string horizontal=x>.68?"東":x<.32?"西":"";
                string direction=horizontal+vertical;
                return country.n+(direction.Length>0?direction+"部":"中部");
            }
            SeaArea nearest=null;
            foreach(var sea in data.seas)
                if(Containing(lon,lat,sea.p)!=null&&(nearest==null||sea.a<nearest.a))nearest=sea;
            return nearest?.n??"未命名海域";
        }
    }
}
